import type { DayKey } from '@/shared/lib/date';

export type RootStackParamList = {
  Tabs: undefined;
  /**
   * Éditeur de séance. Sans `workoutId`, on crée une nouvelle séance à la date
   * donnée ; `templateId` pré-remplit la structure depuis un modèle.
   */
  WorkoutEditor: { workoutId?: string; date?: DayKey; templateId?: string };
  /** Séance en cours. Sans `workoutId`, c'est une sortie libre. */
  RunSession: { workoutId?: string };
  RunSummary: { activityId: string };
  ActivityDetail: { activityId: string };
  Zones: undefined;
  Backup: undefined;
  /** Cadre d'un plan. Sans `planId`, on en crée un nouveau. */
  PlanBuilder: { planId?: string } | undefined;
  PlanDetail: { planId: string };
};

export type TabParamList = {
  Plan: undefined;
  Stats: undefined;
  Run: undefined;
  Activities: undefined;
  Settings: undefined;
};
