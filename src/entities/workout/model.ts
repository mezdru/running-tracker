// Structure d'une séance. Le modèle reprend la logique des montres de sport —
// une suite de blocs, dont certains sont des répétitions — mais s'arrête à DEUX
// niveaux : un bloc simple, ou un bloc répété contenant des étapes. Les
// répétitions imbriquées existent sur le papier ; en pratique, elles rendent
// l'éditeur illisible pour un gain nul sur une séance de course à pied.
import type { DayKey } from '@/shared/lib/date';
import { newId } from '@/shared/lib/id';

export type StepKind = 'warmup' | 'run' | 'interval' | 'recovery' | 'cooldown';

/**
 * Chaque étape se termine sur une distance ou sur une durée — jamais sur une
 * validation manuelle. C'est ce qui rend l'estimation d'une séance exacte
 * plutôt qu'approximative ; passer une étape avant terme reste possible depuis
 * l'écran de course, mais ça relève de l'exécution, pas du plan.
 */
export type StepTarget =
  | { type: 'distance'; meters: number }
  | { type: 'time'; seconds: number };

export type Step = {
  id: string;
  kind: StepKind;
  target: StepTarget;
  zoneId: string;
  note?: string;
};

export type Block =
  | { id: string; type: 'single'; step: Step }
  | { id: string; type: 'repeat'; count: number; steps: Step[] };

export type WorkoutKind =
  | 'easy'
  | 'long'
  | 'intervals'
  | 'tempo'
  | 'race'
  | 'recovery'
  | 'other';

export type Workout = {
  id: string;
  date: DayKey;
  name: string;
  kind: WorkoutKind;
  notes: string;
  blocks: Block[];
  /** Distance et durée estimées, recalculées à chaque enregistrement. */
  estDistanceM: number;
  estDurationS: number;
  /** Rang dans la journée, pour les jours à deux séances. */
  position: number;
  /** Séance cochée comme faite, indépendamment d'un enregistrement GPS. */
  done: boolean;
  createdAt: number;
  updatedAt: number;
};

export const STEP_KIND_LABEL: Record<StepKind, string> = {
  warmup: 'Échauffement',
  run: 'Course',
  interval: 'Intervalle',
  recovery: 'Récupération',
  cooldown: 'Retour au calme',
};

export const WORKOUT_KIND_LABEL: Record<WorkoutKind, string> = {
  easy: 'Footing',
  long: 'Sortie longue',
  intervals: 'Fractionné',
  tempo: 'Tempo / seuil',
  race: 'Course',
  recovery: 'Récupération',
  other: 'Autre',
};

/** Ordre d'affichage des types dans les sélecteurs. */
export const WORKOUT_KINDS: WorkoutKind[] = [
  'easy',
  'long',
  'intervals',
  'tempo',
  'recovery',
  'race',
  'other',
];

export function makeStep(partial: Partial<Step> & { zoneId: string }): Step {
  return {
    id: newId('st'),
    kind: 'run',
    target: { type: 'distance', meters: 1000 },
    ...partial,
  };
}

export function singleBlock(step: Step): Block {
  return { id: newId('bl'), type: 'single', step };
}

export function repeatBlock(count: number, steps: Step[]): Block {
  return { id: newId('bl'), type: 'repeat', count, steps };
}

/** Toutes les étapes d'un bloc, répétitions non déroulées. */
export function blockSteps(block: Block): Step[] {
  return block.type === 'single' ? [block.step] : block.steps;
}

/**
 * Duplique une structure en RÉGÉNÉRANT tous les identifiants. Indispensable :
 * dupliquer une séance ou copier une semaine sans cela produirait deux
 * structures partageant les mêmes ids, et l'éditeur modifierait les deux à la
 * fois — bug silencieux et très difficile à relier à sa cause.
 */
export function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map((block) =>
    block.type === 'single'
      ? { id: newId('bl'), type: 'single', step: { ...block.step, id: newId('st') } }
      : {
          id: newId('bl'),
          type: 'repeat',
          count: block.count,
          steps: block.steps.map((step) => ({ ...step, id: newId('st') })),
        },
  );
}
