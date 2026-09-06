// État global du plan : séances, activités enregistrées et réglages. Un seul
// magasin plutôt qu'un par domaine, parce que les trois sont liés à chaque
// rendu — une estimation de séance dépend des réglages d'allure, un jour du
// calendrier affiche à la fois la séance prévue et l'effort réellement couru.
//
// Le magasin est la SOURCE DE VÉRITÉ EN MÉMOIRE et SQLite le journal
// persistant : chaque action écrit en base puis met à jour l'état. Les données
// tiennent en mémoire (cf. `listWorkouts`), donc rien n'a jamais besoin d'être
// rechargé pour afficher un écran.
import { create } from 'zustand';

import type { Activity } from '@/entities/activity/model';
import {
  deleteActivity as dbDeleteActivity,
  listActivities,
  saveActivity,
} from '@/entities/activity/repo';
import { paceTable } from '@/entities/pace/model';
import { DEFAULT_SETTINGS, type Settings } from '@/entities/settings/model';
import { loadSettings, saveSettings } from '@/entities/settings/repo';
import { estimateBlocks } from '@/entities/workout/estimate';
import { cloneBlocks, type Block, type Workout, type WorkoutKind } from '@/entities/workout/model';
import {
  deleteWorkout as dbDeleteWorkout,
  deleteWorkoutsInRange,
  listWorkouts,
  saveWorkout,
} from '@/entities/workout/repo';
import { transaction } from '@/shared/db';
import { shiftKey, weekDays, weekKey, type DayKey } from '@/shared/lib/date';
import { fromKey, toKey } from '@/shared/lib/date';
import { newId } from '@/shared/lib/id';

/** Contenu d'une semaine mis de côté par « Copier la semaine ». */
export type WeekClipboard = {
  sourceMonday: DayKey;
  /** Séances relatives au lundi source : `offset` vaut 0 à 6. */
  items: { offset: number; workout: Workout }[];
};

type PlanState = {
  ready: boolean;
  settings: Settings;
  workouts: Workout[];
  activities: Activity[];
  clipboard: WeekClipboard | null;

  hydrate: () => void;
  updateSettings: (patch: Partial<Settings>) => void;

  createWorkout: (input: {
    date: DayKey;
    name: string;
    kind: WorkoutKind;
    blocks: Block[];
    notes?: string;
  }) => Workout;
  updateWorkout: (id: string, patch: Partial<Omit<Workout, 'id' | 'createdAt'>>) => void;
  removeWorkout: (id: string) => void;
  duplicateWorkout: (id: string, date?: DayKey) => Workout | null;
  moveWorkout: (id: string, date: DayKey) => void;
  toggleDone: (id: string) => void;

  copyWeek: (monday: DayKey) => number;
  pasteWeek: (monday: DayKey, mode: 'replace' | 'merge') => number;
  clearWeek: (monday: DayKey) => number;
  shiftPlan: (fromMonday: DayKey, weeks: number) => void;

  addActivity: (activity: Activity) => void;
  removeActivity: (id: string) => void;
  linkActivity: (activityId: string, workoutId: string | null) => void;
};

/** Recalcule distance et durée prévues à partir des allures courantes. */
function withEstimate(workout: Workout, settings: Settings): Workout {
  const paces = paceTable(settings.zones, settings.vmaKmh);
  const estimate = estimateBlocks(workout.blocks, paces);
  return { ...workout, estDistanceM: estimate.distanceM, estDurationS: estimate.durationS };
}

function sortWorkouts(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) =>
    a.date === b.date ? a.position - b.position : a.date < b.date ? -1 : 1,
  );
}

export const usePlanStore = create<PlanState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  workouts: [],
  activities: [],
  clipboard: null,

  hydrate: () => {
    const settings = loadSettings();
    const workouts = listWorkouts().map((workout) => withEstimate(workout, settings));
    set({ ready: true, settings, workouts, activities: listActivities() });
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    saveSettings(settings);
    // Changer la VMA ou une zone change l'allure cible de TOUTES les séances :
    // les estimations sont donc recalculées et réécrites en bloc, sinon le
    // calendrier afficherait des durées correspondant à l'ancienne forme.
    const workouts = get().workouts.map((workout) => withEstimate(workout, settings));
    transaction(() => {
      for (const workout of workouts) saveWorkout(workout);
    });
    set({ settings, workouts });
  },

  createWorkout: ({ date, name, kind, blocks, notes = '' }) => {
    const now = Date.now();
    const sameDay = get().workouts.filter((w) => w.date === date);
    const workout = withEstimate(
      {
        id: newId('wk'),
        date,
        name,
        kind,
        notes,
        blocks,
        estDistanceM: 0,
        estDurationS: 0,
        position: sameDay.length,
        done: false,
        createdAt: now,
        updatedAt: now,
      },
      get().settings,
    );
    saveWorkout(workout);
    set({ workouts: sortWorkouts([...get().workouts, workout]) });
    return workout;
  },

  updateWorkout: (id, patch) => {
    const current = get().workouts.find((w) => w.id === id);
    if (!current) return;
    const next = withEstimate(
      { ...current, ...patch, updatedAt: Date.now() },
      get().settings,
    );
    saveWorkout(next);
    set({ workouts: sortWorkouts(get().workouts.map((w) => (w.id === id ? next : w))) });
  },

  removeWorkout: (id) => {
    dbDeleteWorkout(id);
    set({
      workouts: get().workouts.filter((w) => w.id !== id),
      // La séance disparaît, l'effort couru reste : on dénoue simplement le
      // lien côté mémoire, comme le fait ON DELETE SET NULL côté base.
      activities: get().activities.map((a) =>
        a.workoutId === id ? { ...a, workoutId: null } : a,
      ),
    });
  },

  duplicateWorkout: (id, date) => {
    const source = get().workouts.find((w) => w.id === id);
    if (!source) return null;
    return get().createWorkout({
      date: date ?? source.date,
      name: source.name,
      kind: source.kind,
      notes: source.notes,
      blocks: cloneBlocks(source.blocks),
    });
  },

  moveWorkout: (id, date) => {
    const workouts = get().workouts;
    const position = workouts.filter((w) => w.date === date && w.id !== id).length;
    get().updateWorkout(id, { date, position });
  },

  toggleDone: (id) => {
    const current = get().workouts.find((w) => w.id === id);
    if (current) get().updateWorkout(id, { done: !current.done });
  },

  copyWeek: (monday) => {
    const days = weekDays(fromKey(monday)).map(toKey);
    const items = get()
      .workouts.filter((w) => days.includes(w.date))
      .map((workout) => ({ offset: days.indexOf(workout.date), workout }));
    set({ clipboard: { sourceMonday: monday, items } });
    return items.length;
  },

  pasteWeek: (monday, mode) => {
    const clipboard = get().clipboard;
    if (!clipboard || clipboard.items.length === 0) return 0;

    const days = weekDays(fromKey(monday)).map(toKey);
    const now = Date.now();
    // Les identifiants sont régénérés (séance ET étapes) : sans cela, coller
    // deux fois la même semaine créerait des séances partageant leurs ids.
    const created: Workout[] = clipboard.items.map((item, index) => ({
      ...item.workout,
      id: newId('wk'),
      date: shiftKey(monday, item.offset),
      blocks: cloneBlocks(item.workout.blocks),
      done: false,
      position: index,
      createdAt: now,
      updatedAt: now,
    }));

    let kept = get().workouts;
    transaction(() => {
      if (mode === 'replace') {
        deleteWorkoutsInRange(days[0], days[6]);
        kept = kept.filter((w) => !days.includes(w.date));
      }
      for (const workout of created) saveWorkout(workout);
    });

    // Les positions sont réattribuées par jour APRÈS coup : en mode fusion, une
    // séance collée doit se ranger derrière celles déjà présentes ce jour-là.
    const merged = sortWorkouts([...kept, ...created]);
    const byDay = new Map<DayKey, number>();
    const renumbered = merged.map((workout) => {
      const index = byDay.get(workout.date) ?? 0;
      byDay.set(workout.date, index + 1);
      return workout.position === index ? workout : { ...workout, position: index };
    });
    transaction(() => {
      for (const workout of renumbered) saveWorkout(workout);
    });

    set({ workouts: renumbered });
    return created.length;
  },

  clearWeek: (monday) => {
    const days = weekDays(fromKey(monday)).map(toKey);
    const removed = get().workouts.filter((w) => days.includes(w.date));
    if (removed.length === 0) return 0;
    transaction(() => deleteWorkoutsInRange(days[0], days[6]));
    set({ workouts: get().workouts.filter((w) => !days.includes(w.date)) });
    return removed.length;
  },

  shiftPlan: (fromMonday, weeks) => {
    if (weeks === 0) return;
    const moved = get().workouts.map((workout) =>
      workout.date >= fromMonday
        ? { ...workout, date: shiftKey(workout.date, weeks * 7), updatedAt: Date.now() }
        : workout,
    );
    transaction(() => {
      for (const workout of moved) saveWorkout(workout);
    });
    set({ workouts: sortWorkouts(moved) });
  },

  addActivity: (activity) => {
    saveActivity(activity);
    // La liste garde les activités les plus récentes en tête, comme la requête.
    set({ activities: [activity, ...get().activities] });
    if (activity.workoutId) get().updateWorkout(activity.workoutId, { done: true });
  },

  removeActivity: (id) => {
    dbDeleteActivity(id);
    set({ activities: get().activities.filter((a) => a.id !== id) });
  },

  linkActivity: (activityId, workoutId) => {
    const activity = get().activities.find((a) => a.id === activityId);
    if (!activity) return;
    const next = { ...activity, workoutId };
    saveActivity(next);
    set({ activities: get().activities.map((a) => (a.id === activityId ? next : a)) });
    if (workoutId) get().updateWorkout(workoutId, { done: true });
  },
}));

// --- Sélecteurs -------------------------------------------------------------

export function workoutsOn(workouts: Workout[], date: DayKey): Workout[] {
  return workouts.filter((w) => w.date === date);
}

export type WeekSummary = {
  monday: DayKey;
  sessions: number;
  plannedDistanceM: number;
  plannedDurationS: number;
  doneDistanceM: number;
  doneSessions: number;
};

/** Totaux d'une semaine : ce qui est prévu, et ce qui a déjà été fait. */
export function weekSummary(
  workouts: Workout[],
  activities: Activity[],
  monday: DayKey,
): WeekSummary {
  const days = new Set(weekDays(fromKey(monday)).map(toKey));
  const inWeek = workouts.filter((w) => days.has(w.date));
  const doneIds = new Set(inWeek.filter((w) => w.done).map((w) => w.id));

  // Le réalisé s'appuie d'abord sur les activités enregistrées (distance
  // mesurée) et retombe sur l'estimation pour une séance cochée à la main.
  let doneDistanceM = 0;
  const measured = new Set<string>();
  for (const activity of activities) {
    if (activity.workoutId && doneIds.has(activity.workoutId)) {
      doneDistanceM += activity.distanceM;
      measured.add(activity.workoutId);
    }
  }
  for (const workout of inWeek) {
    if (workout.done && !measured.has(workout.id)) doneDistanceM += workout.estDistanceM;
  }

  return {
    monday,
    sessions: inWeek.length,
    plannedDistanceM: inWeek.reduce((sum, w) => sum + w.estDistanceM, 0),
    plannedDurationS: inWeek.reduce((sum, w) => sum + w.estDurationS, 0),
    doneDistanceM,
    doneSessions: inWeek.filter((w) => w.done).length,
  };
}

export function mondayOf(date: DayKey): DayKey {
  return weekKey(fromKey(date));
}
