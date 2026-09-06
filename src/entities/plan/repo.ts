import { db } from '@/shared/db';

import type { PlanGoal, TrainingPlan } from './model';

type Row = {
  id: string;
  name: string;
  goal: string;
  start_monday: string;
  weeks: number;
  race_date: string | null;
  weekly_targets: string;
  notes: string;
  created_at: number;
  updated_at: number;
};

function toPlan(row: Row): TrainingPlan {
  let weeklyTargetsM: number[] = [];
  try {
    const parsed: unknown = JSON.parse(row.weekly_targets);
    if (Array.isArray(parsed)) weeklyTargetsM = parsed.filter((v) => typeof v === 'number');
  } catch {
    // Objectifs illisibles : le plan reste visible, ses semaines sans cible.
  }
  return {
    id: row.id,
    name: row.name,
    goal: row.goal as PlanGoal,
    startMonday: row.start_monday,
    weeks: row.weeks,
    raceDate: row.race_date,
    weeklyTargetsM,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listPlans(): TrainingPlan[] {
  return db()
    .getAllSync<Row>('SELECT * FROM plans ORDER BY start_monday DESC')
    .map(toPlan);
}

export function savePlan(plan: TrainingPlan): void {
  db().runSync(
    `INSERT INTO plans
       (id, name, goal, start_monday, weeks, race_date, weekly_targets, notes,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       goal = excluded.goal,
       start_monday = excluded.start_monday,
       weeks = excluded.weeks,
       race_date = excluded.race_date,
       weekly_targets = excluded.weekly_targets,
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
    [
      plan.id,
      plan.name,
      plan.goal,
      plan.startMonday,
      plan.weeks,
      plan.raceDate,
      JSON.stringify(plan.weeklyTargetsM),
      plan.notes,
      plan.createdAt,
      plan.updatedAt,
    ],
  );
}

/**
 * Supprime un plan SANS toucher aux séances. Un plan n'est qu'un cadre : les
 * séances saisies restent au calendrier, c'est du travail réel.
 */
export function deletePlan(id: string): void {
  db().runSync('DELETE FROM plans WHERE id = ?', [id]);
}
