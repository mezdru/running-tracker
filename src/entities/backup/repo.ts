// Lecture et écriture d'une sauvegarde complète.
//
// Tout passe par une TRANSACTION : une restauration interrompue à mi-chemin —
// application tuée, mémoire pleine — laisserait une base à moitié écrasée,
// c'est-à-dire exactement la perte de données que la sauvegarde est censée
// empêcher. Soit tout est restauré, soit rien ne bouge.
import Constants from 'expo-constants';

import { listActivitiesWithTracks, saveActivity } from '@/entities/activity/repo';
import { deletePlan, listPlans, savePlan } from '@/entities/plan/repo';
import { loadSettings, writeSettings } from '@/entities/settings/repo';
import type { Workout } from '@/entities/workout/model';
import { listWorkouts, saveWorkout } from '@/entities/workout/repo';
import { listUserTemplates } from '@/entities/workout/templates';
import { db, transaction } from '@/shared/db';

import { BACKUP_VERSION, type Backup } from './model';

/** Instantané complet de l'état de l'app. */
export function collectBackup(): Backup {
  return {
    format: 'allure-backup',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    appVersion: Constants.expoConfig?.version ?? '?',
    settings: loadSettings(),
    workouts: listWorkouts(),
    activities: listActivitiesWithTracks(),
    templates: listUserTemplates(),
    plans: listPlans(),
  };
}

export type RestoreMode = 'replace' | 'merge';

export type RestoreResult = {
  workouts: number;
  activities: number;
  templates: number;
  plans: number;
};

/**
 * Restaure une sauvegarde.
 *
 * `replace` remet l'app dans l'état exact du fichier ; `merge` n'ajoute que ce
 * qui manque et ne touche à rien d'existant. Les deux ont leur usage : le
 * premier après une réinstallation, le second pour récupérer des séances
 * perdues sans sacrifier celles saisies depuis.
 */
export function restoreBackup(backup: Backup, mode: RestoreMode): RestoreResult {
  const database = db();
  const result: RestoreResult = { workouts: 0, activities: 0, templates: 0, plans: 0 };

  const existingWorkouts = new Set(listWorkouts().map((workout) => workout.id));
  const existingActivities = new Set(
    database
      .getAllSync<{ id: string }>('SELECT id FROM activities')
      .map((row) => row.id),
  );
  const existingTemplates = new Set(listUserTemplates().map((template) => template.id));
  const existingPlans = listPlans();

  transaction(() => {
    if (mode === 'replace') {
      // L'ordre compte : les activités référencent les séances.
      database.runSync('DELETE FROM activities');
      database.runSync('DELETE FROM workouts');
      database.runSync('DELETE FROM templates');
      for (const plan of existingPlans) deletePlan(plan.id);
      existingWorkouts.clear();
      existingActivities.clear();
      existingTemplates.clear();
    }

    for (const workout of backup.workouts) {
      if (existingWorkouts.has(workout.id)) continue;
      saveWorkout(normalizeWorkout(workout));
      result.workouts += 1;
    }

    for (const activity of backup.activities) {
      if (existingActivities.has(activity.id)) continue;
      saveActivity({
        ...activity,
        workoutId: linkableWorkoutId(activity.workoutId, backup.workouts, existingWorkouts),
      });
      result.activities += 1;
    }

    for (const template of backup.templates) {
      if (existingTemplates.has(template.id)) continue;
      database.runSync(
        'INSERT INTO templates (id, name, kind, blocks, created_at) VALUES (?, ?, ?, ?, ?)',
        [
          template.id,
          template.name,
          template.kind,
          JSON.stringify(template.blocks ?? []),
          Date.now(),
        ],
      );
      result.templates += 1;
    }

    const keptPlans = new Set(mode === 'replace' ? [] : existingPlans.map((p) => p.id));
    for (const plan of backup.plans ?? []) {
      if (keptPlans.has(plan.id)) continue;
      savePlan(plan);
      result.plans += 1;
    }

    // Les réglages ne sont écrasés qu'en remplacement : en fusion, ceux en
    // place sont plus récents que ceux du fichier par définition.
    // `writeSettings` et non `saveSettings` : on est DÉJÀ dans une transaction.
    if (mode === 'replace') writeSettings(backup.settings);
  });

  return result;
}

/**
 * Séance à laquelle rattacher une activité restaurée, ou `null`.
 *
 * Une activité peut désigner une séance absente du fichier — supprimée depuis,
 * ou sauvegarde partielle. La contrainte de clé étrangère refuserait alors
 * l'insertion et l'EFFORT SERAIT PERDU, ce qui est exactement l'inverse du but
 * d'une restauration. On dénoue le lien et on garde la trace.
 */
export function linkableWorkoutId(
  workoutId: string | null,
  restored: { id: string }[],
  existing: Set<string>,
): string | null {
  if (!workoutId) return null;
  if (existing.has(workoutId)) return workoutId;
  return restored.some((workout) => workout.id === workoutId) ? workoutId : null;
}

/**
 * Complète les champs qu'une sauvegarde ancienne pourrait ne pas avoir.
 * Une séance sans `blocks` vaut mieux qu'une restauration qui échoue.
 */
function normalizeWorkout(workout: Workout): Workout {
  const now = Date.now();
  return {
    ...workout,
    notes: workout.notes ?? '',
    blocks: Array.isArray(workout.blocks) ? workout.blocks : [],
    estDistanceM: Number.isFinite(workout.estDistanceM) ? workout.estDistanceM : 0,
    estDurationS: Number.isFinite(workout.estDurationS) ? workout.estDurationS : 0,
    position: Number.isFinite(workout.position) ? workout.position : 0,
    done: workout.done === true,
    createdAt: workout.createdAt ?? now,
    updatedAt: workout.updatedAt ?? now,
  };
}
