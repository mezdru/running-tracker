// Accès aux séances. La couche de persistance ne connaît que des lignes SQL ;
// c'est ici, et nulle part ailleurs, que `blocks` passe de JSON à structure
// typée. Le reste de l'app ne manipule que des `Workout`.
import { db } from '@/shared/db';
import type { DayKey } from '@/shared/lib/date';

import type { Block, Workout, WorkoutKind } from './model';

type Row = {
  id: string;
  date: string;
  name: string;
  kind: string;
  notes: string;
  blocks: string;
  est_distance_m: number;
  est_duration_s: number;
  position: number;
  done: number;
  created_at: number;
  updated_at: number;
};

function toWorkout(row: Row): Workout {
  let blocks: Block[] = [];
  try {
    const parsed: unknown = JSON.parse(row.blocks);
    if (Array.isArray(parsed)) blocks = parsed as Block[];
  } catch {
    // Une structure illisible ne doit pas faire tomber tout le calendrier :
    // la séance reste visible, vide, et se répare en l'éditant.
  }
  return {
    id: row.id,
    date: row.date,
    name: row.name,
    kind: row.kind as WorkoutKind,
    notes: row.notes,
    blocks,
    estDistanceM: row.est_distance_m,
    estDurationS: row.est_duration_s,
    position: row.position,
    done: row.done === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Charge TOUTES les séances au démarrage. Assumé : un plan d'entraînement
 * personnel, c'est quelques centaines de lignes de quelques centaines d'octets.
 * Les tenir en mémoire rend le calendrier, les totaux de semaine et le
 * glisser-déposer instantanés, sans requête à chaque interaction.
 */
export function listWorkouts(): Workout[] {
  return db()
    .getAllSync<Row>('SELECT * FROM workouts ORDER BY date ASC, position ASC')
    .map(toWorkout);
}

export function saveWorkout(workout: Workout): void {
  db().runSync(
    `INSERT INTO workouts
       (id, date, name, kind, notes, blocks, est_distance_m, est_duration_s,
        position, done, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       date = excluded.date,
       name = excluded.name,
       kind = excluded.kind,
       notes = excluded.notes,
       blocks = excluded.blocks,
       est_distance_m = excluded.est_distance_m,
       est_duration_s = excluded.est_duration_s,
       position = excluded.position,
       done = excluded.done,
       updated_at = excluded.updated_at`,
    [
      workout.id,
      workout.date,
      workout.name,
      workout.kind,
      workout.notes,
      JSON.stringify(workout.blocks),
      workout.estDistanceM,
      workout.estDurationS,
      workout.position,
      workout.done ? 1 : 0,
      workout.createdAt,
      workout.updatedAt,
    ],
  );
}

export function deleteWorkout(id: string): void {
  db().runSync('DELETE FROM workouts WHERE id = ?', [id]);
}

export function deleteWorkoutsInRange(from: DayKey, to: DayKey): void {
  db().runSync('DELETE FROM workouts WHERE date >= ? AND date <= ?', [from, to]);
}
