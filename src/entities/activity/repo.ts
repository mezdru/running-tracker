// Accès aux activités enregistrées. La trace GPS est stockée en JSON dans la
// ligne plutôt que dans une table de points : une heure de course fait environ
// 3 000 points, soit quelques centaines de kilo-octets — largement à la portée
// d'une colonne, et on s'épargne une jointure sur le seul accès qui existe
// (charger une activité entière pour l'afficher sur la carte).
import { db } from '@/shared/db';

import type { Activity } from './model';

type Row = {
  id: string;
  workout_id: string | null;
  started_at: number;
  ended_at: number;
  distance_m: number;
  duration_s: number;
  moving_s: number;
  elev_gain_m: number;
  track: string;
  splits: string;
  laps: string;
  strava_activity_id: string | null;
  strava_shared_at: number | null;
  created_at: number;
};

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toActivity(row: Row): Activity {
  return {
    id: row.id,
    workoutId: row.workout_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    distanceM: row.distance_m,
    durationS: row.duration_s,
    movingS: row.moving_s,
    elevGainM: row.elev_gain_m,
    track: parseJson(row.track, []),
    splits: parseJson(row.splits, []),
    laps: parseJson(row.laps, []),
    stravaActivityId: row.strava_activity_id,
    stravaSharedAt: row.strava_shared_at,
    createdAt: row.created_at,
  };
}

/**
 * Liste l'historique SANS la trace GPS : c'est de loin la plus grosse colonne
 * et la liste n'en affiche rien. La trace n'est lue que par `getActivity`,
 * quand on ouvre le détail et sa carte.
 */
export function listActivities(): Activity[] {
  return db()
    .getAllSync<Row>(
      `SELECT id, workout_id, started_at, ended_at, distance_m, duration_s, moving_s,
              elev_gain_m, '[]' AS track, splits, laps, strava_activity_id,
              strava_shared_at, created_at
         FROM activities
        ORDER BY started_at DESC`,
    )
    .map(toActivity);
}

/**
 * Toutes les activités AVEC leur trace. Réservé à la sauvegarde : c'est la
 * seule opération qui a besoin de l'intégralité des données en mémoire, et
 * c'est aussi la plus lourde — plusieurs mégaoctets sur une année de course.
 */
export function listActivitiesWithTracks(): Activity[] {
  return db()
    .getAllSync<Row>('SELECT * FROM activities ORDER BY started_at DESC')
    .map(toActivity);
}

export function getActivity(id: string): Activity | null {
  const row = db().getFirstSync<Row>('SELECT * FROM activities WHERE id = ?', [id]);
  return row ? toActivity(row) : null;
}

export function saveActivity(activity: Activity): void {
  db().runSync(
    `INSERT INTO activities
       (id, workout_id, started_at, ended_at, distance_m, duration_s, moving_s,
        elev_gain_m, track, splits, laps, strava_activity_id, strava_shared_at,
        created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       workout_id = excluded.workout_id,
       strava_activity_id = excluded.strava_activity_id,
       strava_shared_at = excluded.strava_shared_at`,
    [
      activity.id,
      activity.workoutId,
      activity.startedAt,
      activity.endedAt,
      activity.distanceM,
      activity.durationS,
      activity.movingS,
      activity.elevGainM,
      JSON.stringify(activity.track),
      JSON.stringify(activity.splits),
      JSON.stringify(activity.laps),
      activity.stravaActivityId,
      activity.stravaSharedAt,
      activity.createdAt,
    ],
  );
}

export function deleteActivity(id: string): void {
  db().runSync('DELETE FROM activities WHERE id = ?', [id]);
}
