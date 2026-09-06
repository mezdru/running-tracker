// Moteur de séance : la logique qui fait avancer une séance pendant qu'on
// court. Volontairement PURE et sans dépendance native — pas de GPS, pas de
// son, pas d'horloge interne. Elle reçoit des incréments (« il s'est écoulé
// 1,2 s et on a parcouru 4,3 m ») et rend un nouvel état plus la liste des
// évènements à annoncer. C'est ce qui la rend testable au sol, ce qui compte :
// un bug ici ne se découvre autrement qu'en pleine séance.
import type { Lap, Split } from '@/entities/activity/model';
import type { RunStep } from '@/entities/workout/estimate';

/** Étape prête à être exécutée : le déroulé du plan plus l'allure visée. */
export type EngineStep = RunStep & { targetPaceSecPerKm: number };

export type EngineState = {
  /** Étape en cours ; vaut `steps.length` quand la séance est terminée. */
  stepIndex: number;
  stepElapsedS: number;
  stepDistanceM: number;
  /** Durée totale hors pauses. */
  elapsedS: number;
  /** Durée en mouvement, base de l'allure moyenne. */
  movingS: number;
  distanceM: number;
  laps: Lap[];
  splits: Split[];
  /** Distance et temps au dernier kilomètre bouclé. */
  splitBaseDistanceM: number;
  splitBaseElapsedS: number;
  /** Dernier décompte déjà annoncé pour l'étape en cours (3, 2 ou 1). */
  countdownAnnounced: number;
  /** L'approche de fin d'une étape en distance n'est annoncée qu'une fois. */
  approachAnnounced: boolean;
  finished: boolean;
};

export type RunEvent =
  | { type: 'step-start'; step: EngineStep }
  | { type: 'step-end'; step: EngineStep; lap: Lap }
  | { type: 'countdown'; secondsLeft: number }
  | { type: 'approach'; metersLeft: number }
  | { type: 'split'; split: Split }
  | { type: 'finish' };

export type Tick = {
  /** Temps écoulé depuis le tick précédent, en secondes. */
  dtS: number;
  /** Distance parcourue depuis le tick précédent, en mètres. */
  dDistanceM: number;
  /** Faux quand le chrono tourne mais qu'on est à l'arrêt (auto-pause). */
  moving: boolean;
};

export type EngineOptions = {
  /** Distance entre deux annonces automatiques, en mètres (0 = désactivé). */
  splitEveryM: number;
};

export function initialState(): EngineState {
  return {
    stepIndex: 0,
    stepElapsedS: 0,
    stepDistanceM: 0,
    elapsedS: 0,
    movingS: 0,
    distanceM: 0,
    laps: [],
    splits: [],
    splitBaseDistanceM: 0,
    splitBaseElapsedS: 0,
    countdownAnnounced: 0,
    approachAnnounced: false,
    finished: false,
  };
}

function paceOf(distanceM: number, durationS: number): number {
  return distanceM > 0 ? (durationS / distanceM) * 1000 : 0;
}

/** Ce qu'il reste à couvrir sur l'étape en cours, dans son unité de cible. */
export function stepRemaining(
  step: EngineStep,
  state: Pick<EngineState, 'stepElapsedS' | 'stepDistanceM'>,
): { type: 'time'; seconds: number } | { type: 'distance'; meters: number } {
  return step.target.type === 'time'
    ? { type: 'time', seconds: Math.max(0, step.target.seconds - state.stepElapsedS) }
    : { type: 'distance', meters: Math.max(0, step.target.meters - state.stepDistanceM) };
}

/** Avancement de l'étape en cours, entre 0 et 1 — alimente l'anneau de progression. */
export function stepProgress(
  step: EngineStep,
  state: Pick<EngineState, 'stepElapsedS' | 'stepDistanceM'>,
): number {
  const total =
    step.target.type === 'time' ? step.target.seconds : step.target.meters;
  if (total <= 0) return 1;
  const done = step.target.type === 'time' ? state.stepElapsedS : state.stepDistanceM;
  return Math.min(1, Math.max(0, done / total));
}

/**
 * Seuil d'annonce « fin d'étape proche » pour une cible en distance. Fixe à
 * 100 m sur les longues portions, ramené au quart sur les fractions courtes —
 * annoncer 100 m avant la fin d'un 200 m reviendrait à l'annoncer au milieu.
 */
function approachThreshold(meters: number): number {
  return Math.min(100, Math.max(25, meters / 4));
}

/**
 * Fait avancer la séance d'un tick.
 *
 * Le point délicat est le REPORT : un tick d'une seconde peut terminer l'étape
 * en cours après 0,3 s et devoir verser les 0,7 s restantes — et la fraction de
 * distance correspondante — à l'étape suivante. Sans ce report, une série de
 * 30/30 dérive d'une bonne seconde par répétition et la douzième tombe à côté.
 */
export function advance(
  state: EngineState,
  steps: EngineStep[],
  tick: Tick,
  options: EngineOptions,
): { state: EngineState; events: RunEvent[] } {
  const events: RunEvent[] = [];
  let next: EngineState = { ...state };

  if (next.finished) return { state: next, events };

  let remainingTime = Math.max(0, tick.dtS);
  let remainingDistance = Math.max(0, tick.dDistanceM);

  next.elapsedS += remainingTime;
  next.movingS += tick.moving ? remainingTime : 0;
  next.distanceM += remainingDistance;

  // Sortie libre : aucun plan à dérouler, on ne fait qu'accumuler.
  if (steps.length === 0) {
    next.stepElapsedS += remainingTime;
    next.stepDistanceM += remainingDistance;
    return { state: emitSplits(next, events, options), events };
  }

  // `guard` : borne de sécurité. Une étape de cible nulle (0 s, 0 m) se
  // terminerait instantanément et la boucle tournerait sans fin sur un plan
  // mal saisi. On avance au maximum d'une étape par itération.
  let guard = steps.length + 1;
  while (guard > 0 && next.stepIndex < steps.length) {
    guard -= 1;
    const step = steps[next.stepIndex];

    // Part du tick que cette étape peut absorber avant d'être terminée.
    let usedTime = remainingTime;
    let usedDistance = remainingDistance;
    let completes = false;

    if (step.target.type === 'time') {
      const needed = step.target.seconds - next.stepElapsedS;
      if (needed <= remainingTime) {
        completes = true;
        usedTime = Math.max(0, needed);
        // La distance suit la même proportion que le temps consommé.
        usedDistance = remainingTime > 0 ? remainingDistance * (usedTime / remainingTime) : 0;
      }
    } else {
      const needed = step.target.meters - next.stepDistanceM;
      if (needed <= remainingDistance) {
        completes = true;
        usedDistance = Math.max(0, needed);
        usedTime = remainingDistance > 0 ? remainingTime * (usedDistance / remainingDistance) : 0;
      }
    }

    next.stepElapsedS += usedTime;
    next.stepDistanceM += usedDistance;

    if (!completes) {
      // Annonces de fin d'étape imminente, une seule fois par palier.
      const remaining = stepRemaining(step, next);
      if (remaining.type === 'time') {
        const secondsLeft = Math.ceil(remaining.seconds);
        if (
          secondsLeft <= 3 &&
          secondsLeft >= 1 &&
          (next.countdownAnnounced === 0 || secondsLeft < next.countdownAnnounced)
        ) {
          next.countdownAnnounced = secondsLeft;
          events.push({ type: 'countdown', secondsLeft });
        }
      } else if (
        step.target.type === 'distance' &&
        !next.approachAnnounced &&
        remaining.meters <= approachThreshold(step.target.meters)
      ) {
        next.approachAnnounced = true;
        events.push({ type: 'approach', metersLeft: Math.round(remaining.meters) });
      }
      remainingTime = 0;
      remainingDistance = 0;
      break;
    }

    const lap: Lap = {
      key: step.key,
      label: step.label,
      zoneId: step.zoneId,
      targetPaceSecPerKm: step.targetPaceSecPerKm || null,
      distanceM: next.stepDistanceM,
      durationS: next.stepElapsedS,
      paceSecPerKm: paceOf(next.stepDistanceM, next.stepElapsedS),
    };
    next.laps = [...next.laps, lap];
    events.push({ type: 'step-end', step, lap });

    remainingTime = Math.max(0, remainingTime - usedTime);
    remainingDistance = Math.max(0, remainingDistance - usedDistance);
    next.stepIndex += 1;
    next.stepElapsedS = 0;
    next.stepDistanceM = 0;
    next.countdownAnnounced = 0;
    next.approachAnnounced = false;

    if (next.stepIndex >= steps.length) {
      next.finished = true;
      events.push({ type: 'finish' });
      break;
    }
    events.push({ type: 'step-start', step: steps[next.stepIndex] });
  }

  next = emitSplits(next, events, options);
  return { state: next, events };
}

/**
 * Émet un évènement par kilomètre (ou par palier configuré) franchi. Une
 * boucle et non un `if` : un tick GPS après une perte de signal peut livrer
 * plusieurs centaines de mètres d'un coup, et sur un palier court cela
 * représente plusieurs paliers franchis en une fois.
 */
function emitSplits(state: EngineState, events: RunEvent[], options: EngineOptions): EngineState {
  if (options.splitEveryM <= 0) return state;
  let next = state;
  while (next.distanceM - next.splitBaseDistanceM >= options.splitEveryM) {
    const distanceM = options.splitEveryM;
    // Temps attribué au palier, interpolé sur la portion du tick qui le
    // dépasse : le tick entier fausserait le chrono du kilomètre.
    const overshoot = next.distanceM - next.splitBaseDistanceM - distanceM;
    const spanDistance = next.distanceM - next.splitBaseDistanceM;
    const spanTime = next.elapsedS - next.splitBaseElapsedS;
    const durationS =
      spanDistance > 0 ? spanTime * (distanceM / spanDistance) : spanTime;
    const split: Split = {
      index: next.splits.length + 1,
      distanceM,
      durationS,
      paceSecPerKm: paceOf(distanceM, durationS),
      elevGainM: 0,
    };
    next = {
      ...next,
      splits: [...next.splits, split],
      splitBaseDistanceM: next.distanceM - overshoot,
      splitBaseElapsedS: next.splitBaseElapsedS + durationS,
    };
    events.push({ type: 'split', split });
  }
  return next;
}

/** Passe manuellement à l'étape suivante (bouton « Suivant » de l'écran). */
export function skipStep(
  state: EngineState,
  steps: EngineStep[],
): { state: EngineState; events: RunEvent[] } {
  if (state.finished || state.stepIndex >= steps.length) return { state, events: [] };
  const step = steps[state.stepIndex];
  const lap: Lap = {
    key: step.key,
    label: step.label,
    zoneId: step.zoneId,
    targetPaceSecPerKm: step.targetPaceSecPerKm || null,
    distanceM: state.stepDistanceM,
    durationS: state.stepElapsedS,
    paceSecPerKm: paceOf(state.stepDistanceM, state.stepElapsedS),
  };
  const events: RunEvent[] = [{ type: 'step-end', step, lap }];
  const stepIndex = state.stepIndex + 1;
  const finished = stepIndex >= steps.length;
  if (finished) events.push({ type: 'finish' });
  else events.push({ type: 'step-start', step: steps[stepIndex] });

  return {
    state: {
      ...state,
      laps: [...state.laps, lap],
      stepIndex,
      stepElapsedS: 0,
      stepDistanceM: 0,
      countdownAnnounced: 0,
      approachAnnounced: false,
      finished,
    },
    events,
  };
}
