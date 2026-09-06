// Représentation textuelle et colorielle d'une séance. Regroupé ici pour que
// le calendrier, la vue semaine, l'éditeur et l'écran de course décrivent tous
// une séance de la même façon.
import { formatDistance, formatDurationShort } from '@/shared/lib/format';
import { colors } from '@/shared/theme';

import { blockSteps, type Block, type StepTarget, type WorkoutKind } from './model';

export const KIND_COLOR: Record<WorkoutKind, string> = {
  easy: '#34D399',
  long: '#5AA9FF',
  intervals: '#FF4D4D',
  tempo: '#FFB020',
  race: '#C77DFF',
  recovery: '#7A8794',
  other: colors.textMuted,
};

/** « 400 m » ou « 1 min 30 » — la cible d'une étape, en une poignée de signes. */
export function targetLabel(target: StepTarget): string {
  return target.type === 'distance'
    ? formatDistance(target.meters)
    : formatDurationShort(target.seconds);
}

/**
 * Résumé compact de la structure : « 20 min · 10 × (400 m + 1 min) · 10 min ».
 * C'est la ligne qui permet de reconnaître une séance d'un coup d'œil dans le
 * calendrier, sans l'ouvrir.
 */
export function summarizeBlocks(blocks: Block[]): string {
  const parts = blocks.map((block) => {
    const steps = blockSteps(block);
    if (block.type === 'single') return targetLabel(steps[0].target);
    const inner = steps.map((step) => targetLabel(step.target)).join(' + ');
    return `${block.count} × (${inner})`;
  });
  return parts.join(' · ');
}

/**
 * Étiquette encore plus courte, pour les cases du calendrier mensuel : on ne
 * garde que le bloc le plus significatif, généralement la série.
 */
export function shortSummary(blocks: Block[]): string {
  const repeat = blocks.find((block) => block.type === 'repeat');
  if (repeat && repeat.type === 'repeat') {
    const first = repeat.steps[0];
    return first ? `${repeat.count} × ${targetLabel(first.target)}` : '';
  }
  return blocks.length > 0 ? targetLabel(blockSteps(blocks[0])[0].target) : '';
}
