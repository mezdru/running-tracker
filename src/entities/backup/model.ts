// Format de sauvegarde.
//
// C'est le seul filet de l'app : il n'y a ni serveur ni base distante, donc
// une sauvegarde exportée est LA copie de secours. Deux exigences en
// découlent, et elles guident tout ce fichier :
//
//   1. le format est VERSIONNÉ et se relit tel quel — un fichier écrit
//      aujourd'hui doit se restaurer dans deux ans, y compris après des
//      migrations de schéma ;
//   2. rien n'est jamais restauré sur la foi de son extension. Un fichier
//      choisi par erreur dans l'explorateur ne doit pas écraser un plan
//      d'entraînement, donc tout est validé avant d'écrire quoi que ce soit.
import type { Activity } from '@/entities/activity/model';
import type { TrainingPlan } from '@/entities/plan/model';
import type { Settings } from '@/entities/settings/model';
import type { Workout } from '@/entities/workout/model';
import type { Template } from '@/entities/workout/templates';

/** Incrémentée si la forme du fichier change de façon incompatible. */
export const BACKUP_VERSION = 1;

// Une seule extension : iOS masque la dernière dans l'explorateur de
// fichiers, si bien qu'un `.allure.json` s'affichait « …1900.allure ».
export const BACKUP_EXTENSION = 'json';

export type Backup = {
  format: 'allure-backup';
  version: number;
  exportedAt: number;
  /** Version marketing de l'app qui a produit le fichier, à titre indicatif. */
  appVersion: string;
  settings: Settings;
  workouts: Workout[];
  activities: Activity[];
  templates: Template[];
  /**
   * Optionnel : les sauvegardes du format 1 antérieures aux plans n'en ont
   * pas, et doivent rester restaurables.
   */
  plans?: TrainingPlan[];
};

/** Ce qu'un fichier contient, avant toute décision de restauration. */
export type BackupSummary = {
  exportedAt: number;
  workouts: number;
  activities: number;
  templates: number;
  /** Distance totale des activités, pour reconnaître la bonne sauvegarde. */
  activityDistanceM: number;
};

export type BackupCheck =
  | { ok: true; backup: Backup; summary: BackupSummary }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valide un contenu de fichier et en rend un résumé.
 *
 * Volontairement TOLÉRANTE sur le détail et STRICTE sur la structure : on
 * vérifie qu'il s'agit bien d'une sauvegarde Allure et que les collections
 * sont des tableaux d'objets identifiés, sans exiger que chaque champ de
 * chaque séance soit parfait. Une sauvegarde partiellement lisible vaut
 * infiniment mieux qu'un refus de restaurer.
 */
export function readBackup(raw: string): BackupCheck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "Ce fichier n'est pas du JSON lisible." };
  }

  if (!isRecord(parsed) || parsed.format !== 'allure-backup') {
    return { ok: false, reason: "Ce fichier n'est pas une sauvegarde Allure." };
  }

  const version = typeof parsed.version === 'number' ? parsed.version : 0;
  if (version > BACKUP_VERSION) {
    return {
      ok: false,
      reason: `Sauvegarde créée par une version plus récente de l'app (format ${version}). Mettez l'app à jour avant de restaurer.`,
    };
  }

  // `plans` est absent des toutes premières sauvegardes : son absence est
  // normale, seule une valeur PRÉSENTE et mal formée est une erreur.
  const plans = parsed.plans === undefined ? [] : asIdentifiedArray(parsed.plans);
  if (!plans) return { ok: false, reason: 'Sauvegarde incomplète ou abîmée.' };

  const workouts = asIdentifiedArray(parsed.workouts);
  const activities = asIdentifiedArray(parsed.activities);
  const templates = asIdentifiedArray(parsed.templates);
  if (!workouts || !activities || !templates) {
    return { ok: false, reason: 'Sauvegarde incomplète ou abîmée.' };
  }

  if (!isRecord(parsed.settings)) {
    return { ok: false, reason: 'Sauvegarde sans réglages : fichier abîmé.' };
  }

  const backup: Backup = {
    format: 'allure-backup',
    version,
    exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
    appVersion: typeof parsed.appVersion === 'string' ? parsed.appVersion : '?',
    settings: parsed.settings as unknown as Settings,
    workouts: workouts as unknown as Workout[],
    activities: activities as unknown as Activity[],
    templates: templates as unknown as Template[],
    plans: plans as unknown as TrainingPlan[],
  };

  return { ok: true, backup, summary: summarize(backup) };
}

/** Un tableau d'objets portant tous un `id` non vide, ou `null`. */
function asIdentifiedArray(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.filter(isRecord);
  if (rows.length !== value.length) return null;
  if (rows.some((row) => typeof row.id !== 'string' || row.id.length === 0)) return null;
  return rows;
}

export function summarize(backup: Backup): BackupSummary {
  return {
    exportedAt: backup.exportedAt,
    workouts: backup.workouts.length,
    activities: backup.activities.length,
    templates: backup.templates.length,
    activityDistanceM: backup.activities.reduce(
      (sum, activity) => sum + (Number.isFinite(activity.distanceM) ? activity.distanceM : 0),
      0,
    ),
  };
}

/**
 * Nom de fichier d'une sauvegarde : trié correctement par date dans
 * l'explorateur de fichiers, et lisible sans l'ouvrir.
 */
export function backupFileName(exportedAt: number, prefix = 'allure'): string {
  const date = new Date(exportedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `${prefix}-${stamp}.${BACKUP_EXTENSION}`;
}
