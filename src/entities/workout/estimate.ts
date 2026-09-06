// Estimation d'une séance : distance et durée prévues, dérivées des allures
// cibles. Fonctions pures — elles reçoivent la table des allures et ne lisent
// aucun réglage — pour rester testables et donner exactement le même résultat
// dans l'éditeur, dans le calendrier et dans les totaux de semaine.
import { STEP_KIND_LABEL, blockSteps, type Block, type Step, type StepTarget } from './model';

export type Estimate = { distanceM: number; durationS: number };

const ZERO: Estimate = { distanceM: 0, durationS: 0 };

/** Table `zoneId → secondes par kilomètre`, cf. `entities/pace`. */
export type PaceTable = Record<string, number>;

/**
 * Une étape sans allure connue (zone supprimée entre-temps) est comptée en
 * distance mais pas en durée : mieux vaut un total de kilomètres juste et une
 * durée légèrement basse qu'un `NaN` qui contamine toute la semaine.
 */
export function estimateTarget(target: StepTarget, paceSecPerKm: number): Estimate {
  if (target.type === 'distance') {
    const durationS = paceSecPerKm > 0 ? (target.meters / 1000) * paceSecPerKm : 0;
    return { distanceM: target.meters, durationS };
  }
  const distanceM = paceSecPerKm > 0 ? (target.seconds / paceSecPerKm) * 1000 : 0;
  return { distanceM, durationS: target.seconds };
}

export function estimateStep(step: Step, paces: PaceTable): Estimate {
  return estimateTarget(step.target, paces[step.zoneId] ?? 0);
}

export function estimateBlock(block: Block, paces: PaceTable): Estimate {
  const steps = blockSteps(block);
  const repeat = block.type === 'repeat' ? Math.max(0, block.count) : 1;
  let distanceM = 0;
  let durationS = 0;
  for (const step of steps) {
    const estimate = estimateStep(step, paces);
    distanceM += estimate.distanceM;
    durationS += estimate.durationS;
  }
  return { distanceM: distanceM * repeat, durationS: durationS * repeat };
}

export function estimateBlocks(blocks: Block[], paces: PaceTable): Estimate {
  return blocks.reduce<Estimate>((total, block) => {
    const estimate = estimateBlock(block, paces);
    return {
      distanceM: total.distanceM + estimate.distanceM,
      durationS: total.durationS + estimate.durationS,
    };
  }, ZERO);
}

export function sumEstimates(estimates: Estimate[]): Estimate {
  return estimates.reduce<Estimate>(
    (total, e) => ({
      distanceM: total.distanceM + e.distanceM,
      durationS: total.durationS + e.durationS,
    }),
    ZERO,
  );
}

// --- Déroulé d'exécution ----------------------------------------------------

/**
 * Étape telle qu'elle est réellement exécutée : les répétitions sont déroulées,
 * chaque occurrence devient une étape indépendante avec son propre rang. C'est
 * la forme que consomme le moteur de séance, et elle seule — le moteur n'a
 * jamais à comprendre la notion de bloc.
 */
export type RunStep = {
  /** Identifiant unique dans le déroulé (un `stepId` revient à chaque tour). */
  key: string;
  stepId: string;
  blockId: string;
  kind: Step['kind'];
  target: StepTarget;
  zoneId: string;
  note?: string;
  /** Rang de la répétition, 1-indexé, et total — `undefined` hors répétition. */
  repeatIndex?: number;
  repeatCount?: number;
  index: number;
  /** Libellé prêt à afficher et à lire à voix haute (« Intervalle 3/8 »). */
  label: string;
};

export function flattenBlocks(blocks: Block[]): RunStep[] {
  const out: RunStep[] = [];
  for (const block of blocks) {
    if (block.type === 'single') {
      out.push({
        key: `${block.id}:0:${block.step.id}`,
        stepId: block.step.id,
        blockId: block.id,
        kind: block.step.kind,
        target: block.step.target,
        zoneId: block.step.zoneId,
        note: block.step.note,
        index: out.length,
        label: STEP_KIND_LABEL[block.step.kind],
      });
      continue;
    }
    for (let round = 0; round < Math.max(0, block.count); round += 1) {
      for (const step of block.steps) {
        out.push({
          key: `${block.id}:${round}:${step.id}`,
          stepId: step.id,
          blockId: block.id,
          kind: step.kind,
          target: step.target,
          zoneId: step.zoneId,
          note: step.note,
          repeatIndex: round + 1,
          repeatCount: block.count,
          index: out.length,
          label: `${STEP_KIND_LABEL[step.kind]} ${round + 1}/${block.count}`,
        });
      }
    }
  }
  return out;
}
