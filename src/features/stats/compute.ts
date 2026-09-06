// Statistiques d'entraînement. Fonctions PURES : elles reçoivent les séances,
// les activités et une fenêtre, et rendent des nombres. Aucune ne lit
// l'horloge — la date de référence est toujours un paramètre, sans quoi les
// tests ne pourraient pas exister et un bilan de semaine changerait de valeur
// à minuit.
import { averagePace, type Activity } from '@/entities/activity/model';
import type { PaceZone } from '@/entities/pace/model';
import { WORKOUT_KIND_LABEL, type Workout, type WorkoutKind } from '@/entities/workout/model';
import { fromKey, shiftKey, toKey, weekKey, type DayKey } from '@/shared/lib/date';

export type StatsInput = {
  workouts: Workout[];
  activities: Activity[];
  /** Lundi de la première semaine analysée. */
  fromMonday: DayKey;
  weeks: number;
  /** Objectifs hebdomadaires du plan couvrant la période, si applicable. */
  targetsByMonday?: Record<DayKey, number>;
};

export type WeekStat = {
  monday: DayKey;
  /** Rang dans la période, 1 pour la première semaine. */
  index: number;
  targetM: number | null;
  plannedM: number;
  plannedS: number;
  plannedSessions: number;
  doneM: number;
  doneS: number;
  doneSessions: number;
  elevGainM: number;
  /**
   * Évolution du volume RÉALISÉ par rapport à la semaine précédente, en
   * pourcent. `null` s'il n'y a pas de semaine précédente dans la période, ou
   * si elle était vide — une progression depuis zéro n'a pas de sens.
   */
  changePercent: number | null;
};

/** Nombre de jours entre deux clés, bornes comprises. */
function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / (24 * 3600 * 1000));
}

/** Jour d'une activité, dans le fuseau local. */
function dayOf(activity: Activity): DayKey {
  return toKey(new Date(activity.startedAt));
}

function mondayOfActivity(activity: Activity): DayKey {
  return weekKey(new Date(activity.startedAt));
}

export function weeklyStats({
  workouts,
  activities,
  fromMonday,
  weeks,
  targetsByMonday,
}: StatsInput): WeekStat[] {
  const mondays = Array.from({ length: Math.max(0, weeks) }, (_, i) =>
    shiftKey(fromMonday, i * 7),
  );
  const index = new Map<DayKey, WeekStat>();

  mondays.forEach((monday, i) => {
    index.set(monday, {
      monday,
      index: i + 1,
      targetM: targetsByMonday?.[monday] ?? null,
      plannedM: 0,
      plannedS: 0,
      plannedSessions: 0,
      doneM: 0,
      doneS: 0,
      doneSessions: 0,
      elevGainM: 0,
      changePercent: null,
    });
  });

  for (const workout of workouts) {
    const week = index.get(weekKey(fromKey(workout.date)));
    if (!week) continue;
    week.plannedM += workout.estDistanceM;
    week.plannedS += workout.estDurationS;
    week.plannedSessions += 1;
  }

  for (const activity of activities) {
    const week = index.get(mondayOfActivity(activity));
    if (!week) continue;
    week.doneM += activity.distanceM;
    week.doneS += activity.durationS;
    week.doneSessions += 1;
    week.elevGainM += activity.elevGainM;
  }

  const result = mondays.map((monday) => index.get(monday) as WeekStat);
  for (let i = 1; i < result.length; i += 1) {
    const previous = result[i - 1].doneM;
    if (previous > 0) {
      result[i].changePercent = ((result[i].doneM - previous) / previous) * 100;
    }
  }
  return result;
}

export type PeriodSummary = {
  weeks: number;
  distanceM: number;
  durationS: number;
  movingS: number;
  sessions: number;
  elevGainM: number;
  avgPaceSecPerKm: number;
  longestRunM: number;
  /** Meilleur kilomètre de la période, en s/km (0 si aucun). */
  bestSplitSecPerKm: number;
  /** Jours distincts avec au moins une sortie. */
  activeDays: number;
  weeklyAverageM: number;
  /** Volume prévu par le plan sur la période. */
  plannedM: number;
  /** Réalisé / prévu, en pourcent (`null` si rien n'était prévu). */
  completionPercent: number | null;
};

export function summarize(weeksStats: WeekStat[], activities: Activity[]): PeriodSummary {
  const distanceM = weeksStats.reduce((sum, week) => sum + week.doneM, 0);
  const durationS = weeksStats.reduce((sum, week) => sum + week.doneS, 0);
  const plannedM = weeksStats.reduce((sum, week) => sum + week.plannedM, 0);
  const sessions = weeksStats.reduce((sum, week) => sum + week.doneSessions, 0);

  const mondays = new Set(weeksStats.map((week) => week.monday));
  const inRange = activities.filter((activity) => mondays.has(mondayOfActivity(activity)));

  const movingS = inRange.reduce((sum, activity) => sum + activity.movingS, 0);
  const bestSplit = inRange.reduce((best, activity) => {
    for (const split of activity.splits) {
      if (split.paceSecPerKm > 0 && split.paceSecPerKm < best) best = split.paceSecPerKm;
    }
    return best;
  }, Number.POSITIVE_INFINITY);

  return {
    weeks: weeksStats.length,
    distanceM,
    durationS,
    movingS,
    sessions,
    elevGainM: weeksStats.reduce((sum, week) => sum + week.elevGainM, 0),
    // L'allure moyenne se calcule sur les TOTAUX, pas comme moyenne des
    // allures : une sortie de 20 km ne pèse pas comme un footing de 5 km.
    avgPaceSecPerKm: averagePace({ distanceM, movingS: movingS || durationS }),
    longestRunM: inRange.reduce((max, activity) => Math.max(max, activity.distanceM), 0),
    bestSplitSecPerKm: Number.isFinite(bestSplit) ? bestSplit : 0,
    activeDays: new Set(inRange.map(dayOf)).size,
    weeklyAverageM: weeksStats.length > 0 ? distanceM / weeksStats.length : 0,
    plannedM,
    completionPercent: plannedM > 0 ? (distanceM / plannedM) * 100 : null,
  };
}

// --- Charge d'entraînement --------------------------------------------------

export type LoadVerdict = 'repos' | 'faible' | 'optimal' | 'soutenu' | 'risque';

export type TrainingLoad = {
  /** Volume des 7 derniers jours, en mètres. */
  acuteM: number;
  /** Volume hebdomadaire moyen des 28 derniers jours, en mètres. */
  chronicM: number;
  /** Rapport aigu / chronique, `null` tant qu'il n'y a pas d'historique. */
  ratio: number | null;
  verdict: LoadVerdict;
};

/**
 * Rapport de charge aiguë sur charge chronique.
 *
 * Le principe est celui utilisé en préparation physique : ce n'est pas le
 * volume absolu qui expose à la blessure, c'est l'écart entre ce qu'on vient
 * de faire et ce à quoi le corps est habitué. On compare donc les sept
 * derniers jours à la moyenne hebdomadaire des vingt-huit derniers.
 *
 * Les seuils (0,8 – 1,3 confortable, au-delà de 1,5 exposé) sont ceux
 * communément retenus. Ils ne valent pas diagnostic médical, et l'app ne les
 * présente pas comme tel : ce sont des repères pour se relire.
 */
export function trainingLoad(activities: Activity[], today: DayKey): TrainingLoad {
  const since = (days: number) => shiftKey(today, -days + 1);
  const sum = (from: DayKey) =>
    activities
      .filter((activity) => {
        const day = dayOf(activity);
        return day >= from && day <= today;
      })
      .reduce((total, activity) => total + activity.distanceM, 0);

  const acuteM = sum(since(7));
  const chronicM = sum(since(28)) / 4;

  // La charge chronique divise par quatre semaines : elle n'a de sens que si
  // quatre semaines d'historique existent réellement. Sinon, une première
  // sortie après une longue coupure donnerait mécaniquement un rapport de 4 et
  // une alerte « hausse brutale » absurde. Sous trois semaines d'historique,
  // on ne conclut pas.
  const oldest = activities
    .map(dayOf)
    .filter((day) => day <= today)
    .sort()[0];
  const historyDays = oldest ? daysBetween(oldest, today) : 0;
  if (chronicM <= 0 || historyDays < 21) {
    return { acuteM, chronicM, ratio: null, verdict: acuteM > 0 ? 'optimal' : 'repos' };
  }

  const ratio = acuteM / chronicM;
  const verdict: LoadVerdict =
    ratio < 0.5 ? 'repos' : ratio < 0.8 ? 'faible' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'soutenu' : 'risque';
  return { acuteM, chronicM, ratio, verdict };
}

export const LOAD_LABEL: Record<LoadVerdict, string> = {
  repos: 'Coupure',
  faible: 'En dessous de l’habitude',
  optimal: 'Charge cohérente',
  soutenu: 'Semaine chargée',
  risque: 'Hausse brutale',
};

// --- Répartitions -----------------------------------------------------------

export type KindShare = {
  kind: WorkoutKind | 'free';
  label: string;
  sessions: number;
  distanceM: number;
};

/**
 * Répartition des sorties par type de séance. Une sortie libre — sans séance
 * associée — forme sa propre catégorie plutôt que d'être rangée dans « Autre »
 * avec des séances planifiées : ce n'est pas la même chose.
 */
export function distributionByKind(
  activities: Activity[],
  workouts: Workout[],
): KindShare[] {
  const kindOf = new Map(workouts.map((workout) => [workout.id, workout.kind]));
  const buckets = new Map<WorkoutKind | 'free', KindShare>();

  for (const activity of activities) {
    const kind = (activity.workoutId && kindOf.get(activity.workoutId)) || 'free';
    const existing = buckets.get(kind);
    if (existing) {
      existing.sessions += 1;
      existing.distanceM += activity.distanceM;
      continue;
    }
    buckets.set(kind, {
      kind,
      label: kind === 'free' ? 'Sortie libre' : WORKOUT_KIND_LABEL[kind],
      sessions: 1,
      distanceM: activity.distanceM,
    });
  }

  return [...buckets.values()].sort((a, b) => b.distanceM - a.distanceM);
}

export type ZoneShare = { zoneId: string; label: string; color: string; seconds: number };

/**
 * Temps passé dans chaque allure, lu dans les étapes réellement exécutées.
 * Seules les séances structurées en fournissent — une sortie libre n'a pas
 * d'étape, et c'est normal qu'elle n'apparaisse pas ici.
 */
export function timeInZones(activities: Activity[], zones: PaceZone[]): ZoneShare[] {
  const byId = new Map(zones.map((zone) => [zone.id, zone]));
  const totals = new Map<string, number>();

  for (const activity of activities) {
    for (const lap of activity.laps) {
      if (!lap.zoneId) continue;
      totals.set(lap.zoneId, (totals.get(lap.zoneId) ?? 0) + lap.durationS);
    }
  }

  return [...totals.entries()]
    .map(([zoneId, seconds]) => {
      const zone = byId.get(zoneId);
      return {
        zoneId,
        label: zone?.short ?? '?',
        color: zone?.color ?? '#8B98A8',
        seconds,
      };
    })
    .sort((a, b) => b.seconds - a.seconds);
}

// --- Régularité -------------------------------------------------------------

export type Consistency = {
  /** Semaines de la période avec au moins une sortie. */
  activeWeeks: number;
  /** Plus longue suite de semaines consécutives avec au moins une sortie. */
  longestWeekStreak: number;
};

export function consistency(weeksStats: WeekStat[]): Consistency {
  let longest = 0;
  let current = 0;
  let active = 0;
  for (const week of weeksStats) {
    if (week.doneSessions > 0) {
      active += 1;
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return { activeWeeks: active, longestWeekStreak: longest };
}
