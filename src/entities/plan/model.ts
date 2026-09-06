// Plan d'entraînement : le cadre dans lequel les séances se posent.
//
// Un plan ne contient PAS de séances. Il définit un objectif, une durée et une
// charge hebdomadaire visée ; les séances restent des objets datés du
// calendrier, et leur appartenance au plan se déduit de la date. C'est ce qui
// permet de décaler un plan, d'en changer la durée ou d'en supprimer un sans
// jamais mettre en danger le travail déjà saisi.
import { shiftKey, type DayKey } from '@/shared/lib/date';

export type PlanGoal = '5k' | '10k' | 'semi' | 'marathon' | 'trail' | 'forme';

export const PLAN_GOAL_LABEL: Record<PlanGoal, string> = {
  '5k': '5 km',
  '10k': '10 km',
  semi: 'Semi-marathon',
  marathon: 'Marathon',
  trail: 'Trail',
  forme: 'Forme générale',
};

export const PLAN_GOALS: PlanGoal[] = ['5k', '10k', 'semi', 'marathon', 'trail', 'forme'];

export type TrainingPlan = {
  id: string;
  name: string;
  goal: PlanGoal;
  /** Lundi de la première semaine. */
  startMonday: DayKey;
  weeks: number;
  raceDate: DayKey | null;
  /** Volume visé pour chaque semaine, en mètres. Longueur = `weeks`. */
  weeklyTargetsM: number[];
  notes: string;
  createdAt: number;
  updatedAt: number;
};

/** Paramètres de périodisation, saisis à la création puis modifiables. */
export type PlanShape = {
  weeks: number;
  /** Volume de la première semaine, en mètres. */
  startVolumeM: number;
  /** Progression d'une semaine de charge à la suivante, en pourcent. */
  progressionPercent: number;
  /** Semaine d'assimilation toutes les N semaines (0 = aucune). */
  recoveryEvery: number;
  /** Allègement d'une semaine d'assimilation, en pourcent. */
  recoveryDropPercent: number;
  /** Semaines d'affûtage avant la course (0 = aucun). */
  taperWeeks: number;
};

export const DEFAULT_SHAPE: PlanShape = {
  weeks: 12,
  startVolumeM: 30000,
  // 8 % : au-dessus de 10 % par semaine, la progression de charge est
  // classiquement associée à une hausse du risque de blessure. La valeur reste
  // modifiable, mais le défaut ne doit pas pousser à la faute.
  progressionPercent: 8,
  recoveryEvery: 4,
  recoveryDropPercent: 30,
  taperWeeks: 2,
};

/**
 * Coefficients d'affûtage, du début de l'affûtage jusqu'à la semaine de
 * course. Appliqués au PIC de charge : on réduit le volume en gardant
 * l'intensité, ce que le plan ne modélise pas mais que les séances portent.
 *
 * Rampe linéaire de 75 % à 45 % du pic, quelle que soit la durée : c'est la
 * forme classique d'un affûtage, et elle reste monotone pour deux semaines
 * comme pour quatre. Une semaine seule est un cas à part — c'est la semaine de
 * course, on la pose à la moitié du pic.
 */
function taperFactors(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0.5];
  const start = 0.75;
  const race = 0.45;
  return Array.from(
    { length: count },
    (_, i) => start + (race - start) * (i / (count - 1)),
  );
}

/** Arrondi au demi-kilomètre : un objectif hebdomadaire à 43 217 m est absurde. */
function roundVolume(meters: number): number {
  return Math.round(meters / 500) * 500;
}

/**
 * Construit les objectifs hebdomadaires d'un plan.
 *
 * Trois idées, dans cet ordre : la charge monte d'un pourcentage fixe, une
 * semaine d'assimilation la fait redescendre SANS casser la progression (la
 * semaine suivante repart du niveau atteint, pas du niveau allégé), et
 * l'affûtage final se calcule sur le PIC de charge et non sur la dernière
 * semaine — sinon un affûtage placé juste après une semaine d'assimilation
 * partirait d'une base artificiellement basse.
 */
export function weeklyTargets(shape: PlanShape): number[] {
  const weeks = Math.max(1, Math.round(shape.weeks));
  const taper = Math.min(Math.max(0, Math.round(shape.taperWeeks)), Math.max(0, weeks - 1));
  const loadWeeks = weeks - taper;

  const targets: number[] = [];
  let ramp = Math.max(0, shape.startVolumeM);

  for (let i = 0; i < loadWeeks; i += 1) {
    const isRecovery =
      shape.recoveryEvery > 0 && i > 0 && (i + 1) % shape.recoveryEvery === 0;
    if (isRecovery) {
      targets.push(roundVolume(ramp * (1 - shape.recoveryDropPercent / 100)));
      continue;
    }
    targets.push(roundVolume(ramp));
    ramp *= 1 + shape.progressionPercent / 100;
  }

  const peak = Math.max(shape.startVolumeM, ...targets);
  for (const factor of taperFactors(taper)) targets.push(roundVolume(peak * factor));

  return targets;
}

/** Dernier jour couvert par le plan (dimanche de la dernière semaine). */
export function planEndDate(plan: Pick<TrainingPlan, 'startMonday' | 'weeks'>): DayKey {
  return shiftKey(plan.startMonday, plan.weeks * 7 - 1);
}

/** Le plan couvre-t-il cette date ? */
export function planCovers(
  plan: Pick<TrainingPlan, 'startMonday' | 'weeks'>,
  date: DayKey,
): boolean {
  return date >= plan.startMonday && date <= planEndDate(plan);
}

/** Lundis du plan, dans l'ordre. */
export function planMondays(plan: Pick<TrainingPlan, 'startMonday' | 'weeks'>): DayKey[] {
  return Array.from({ length: plan.weeks }, (_, i) => shiftKey(plan.startMonday, i * 7));
}

/** Volume total visé par le plan, en mètres. */
export function planTotalM(plan: Pick<TrainingPlan, 'weeklyTargetsM'>): number {
  return plan.weeklyTargetsM.reduce((sum, value) => sum + value, 0);
}

/**
 * Plan « en cours » : celui qui couvre aujourd'hui. À défaut, le prochain à
 * commencer — préparer la semaine d'avant fait partie du plan.
 */
export function activePlan(plans: TrainingPlan[], today: DayKey): TrainingPlan | null {
  const current = plans.find((plan) => planCovers(plan, today));
  if (current) return current;
  const upcoming = plans
    .filter((plan) => plan.startMonday > today)
    .sort((a, b) => (a.startMonday < b.startMonday ? -1 : 1));
  return upcoming[0] ?? null;
}
