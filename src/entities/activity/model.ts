// Effort réellement couru, tel qu'il est enregistré par les capteurs. Une
// activité peut exister sans séance associée (sortie libre), et une séance
// peut n'avoir jamais été courue : le lien est optionnel des deux côtés.
import type { TrackPoint } from '@/shared/lib/geo';

/** Bilan d'un kilomètre entier, comme sur une montre. */
export type Split = {
  /** 1 pour le premier kilomètre. */
  index: number;
  distanceM: number;
  durationS: number;
  paceSecPerKm: number;
  elevGainM: number;
};

/** Bilan d'une étape du plan, telle qu'elle a été réellement exécutée. */
export type Lap = {
  key: string;
  label: string;
  zoneId: string | null;
  /** Allure visée par le plan, `null` pour une sortie libre. */
  targetPaceSecPerKm: number | null;
  distanceM: number;
  durationS: number;
  paceSecPerKm: number;
};

export type Activity = {
  id: string;
  /** Séance du plan associée, `null` pour une sortie libre. */
  workoutId: string | null;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  /** Durée totale, pauses comprises. */
  durationS: number;
  /** Durée en mouvement, hors arrêts — la base de l'allure moyenne. */
  movingS: number;
  elevGainM: number;
  track: TrackPoint[];
  splits: Split[];
  laps: Lap[];
  stravaActivityId: string | null;
  /**
   * Date d'envoi vers Strava, en millisecondes (`null` si jamais envoyée).
   * L'app ne sait pas si l'import a été mené à son terme — c'est Strava qui
   * l'exécute —, elle sait seulement que le fichier est parti. C'est
   * suffisant pour éviter un second envoi par inadvertance.
   */
  stravaSharedAt: number | null;
  createdAt: number;
};

/** Allure moyenne sur le temps en mouvement, en secondes par kilomètre. */
export function averagePace(activity: Pick<Activity, 'distanceM' | 'movingS'>): number {
  if (activity.distanceM < 50) return 0;
  return (activity.movingS / activity.distanceM) * 1000;
}
