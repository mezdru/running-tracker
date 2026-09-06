import { advance, initialState, skipStep, stepProgress, type EngineStep } from './engine';

const step = (partial: Partial<EngineStep> & { key: string }): EngineStep => ({
  stepId: partial.key,
  blockId: 'b',
  kind: 'interval',
  target: { type: 'time', seconds: 30 },
  zoneId: 'vma',
  index: 0,
  label: 'Intervalle',
  targetPaceSecPerKm: 225,
  ...partial,
});

const options = { splitEveryM: 1000 };

/** Joue `count` ticks d'une seconde en avançant à `speed` m/s. */
function run(steps: EngineStep[], count: number, speed = 4) {
  let state = initialState();
  const events = [];
  for (let i = 0; i < count; i += 1) {
    const result = advance(state, steps, { dtS: 1, dDistanceM: speed, moving: true }, options);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

describe('cibles en temps', () => {
  it('termine l’étape pile à l’échéance', () => {
    const steps = [step({ key: 'a', target: { type: 'time', seconds: 3 } }), step({ key: 'b' })];
    const { state, events } = run(steps, 3);
    expect(state.stepIndex).toBe(1);
    expect(events.filter((e) => e.type === 'step-end')).toHaveLength(1);
    expect(state.laps[0].durationS).toBeCloseTo(3, 5);
  });

  it('reporte le reste du tick sur l’étape suivante, sans dériver', () => {
    // Douze fois 30/30 en ticks de 1,7 s : aucune échéance ne tombe sur un
    // tick. Sans report, la dernière étape finirait plusieurs secondes trop
    // tard — c'est exactement ce qui déphase une série de fractionné.
    const steps = Array.from({ length: 24 }, (_, i) =>
      step({ key: `s${i}`, target: { type: 'time', seconds: 30 } }),
    );
    let state = initialState();
    for (let i = 0; i < 500 && !state.finished; i += 1) {
      state = advance(state, steps, { dtS: 1.7, dDistanceM: 6.8, moving: true }, options).state;
    }
    expect(state.finished).toBe(true);
    // 24 × 30 s = 720 s ; le dépassement ne peut excéder un tick.
    expect(state.elapsedS).toBeGreaterThanOrEqual(720);
    expect(state.elapsedS).toBeLessThan(720 + 1.7);
    const total = state.laps.reduce((sum, lap) => sum + lap.durationS, 0);
    expect(total).toBeCloseTo(720, 5);
  });

  it('annonce le décompte une seule fois par seconde restante', () => {
    const steps = [step({ key: 'a', target: { type: 'time', seconds: 6 } })];
    const { events } = run(steps, 6);
    const countdowns = events.filter((e) => e.type === 'countdown');
    expect(countdowns.map((e) => (e.type === 'countdown' ? e.secondsLeft : 0))).toEqual([3, 2, 1]);
  });
});

describe('cibles en distance', () => {
  it('termine l’étape sur la distance et non sur le temps', () => {
    const steps = [
      step({ key: 'a', target: { type: 'distance', meters: 400 } }),
      step({ key: 'b' }),
    ];
    const { state } = run(steps, 100, 4); // 400 m atteints au 100e tick
    expect(state.stepIndex).toBe(1);
    expect(state.laps[0].distanceM).toBeCloseTo(400, 5);
    expect(state.laps[0].paceSecPerKm).toBeCloseTo(250, 5);
  });

  it('prévient de l’approche une fois, au quart d’une fraction courte', () => {
    const steps = [step({ key: 'a', target: { type: 'distance', meters: 200 } })];
    const { events } = run(steps, 50, 4);
    const approaches = events.filter((e) => e.type === 'approach');
    expect(approaches).toHaveLength(1);
  });
});

describe('kilomètres automatiques', () => {
  it('émet un palier par kilomètre franchi', () => {
    const { events, state } = run([], 500, 4); // 2 000 m
    expect(events.filter((e) => e.type === 'split')).toHaveLength(2);
    expect(state.splits[0].paceSecPerKm).toBeCloseTo(250, 3);
  });

  it('rattrape plusieurs paliers livrés dans un seul tick GPS', () => {
    // Un point GPS arrivé après une longue perte de signal apporte d'un coup
    // 2,5 km : deux kilomètres complets doivent être bouclés, pas un seul.
    const result = advance(
      initialState(),
      [],
      { dtS: 600, dDistanceM: 2500, moving: true },
      options,
    );
    expect(result.events.filter((e) => e.type === 'split')).toHaveLength(2);
    expect(result.state.splits).toHaveLength(2);
  });

  it('ne découpe rien quand le réglage est à zéro', () => {
    let state = initialState();
    const result = advance(state, [], { dtS: 600, dDistanceM: 2500, moving: true }, {
      splitEveryM: 0,
    });
    state = result.state;
    expect(state.splits).toHaveLength(0);
  });
});

describe('fin de séance', () => {
  it('émet `finish` une seule fois et cesse d’avancer', () => {
    const steps = [step({ key: 'a', target: { type: 'time', seconds: 2 } })];
    let state = initialState();
    const events = [];
    for (let i = 0; i < 5; i += 1) {
      const result = advance(state, steps, { dtS: 1, dDistanceM: 4, moving: true }, options);
      state = result.state;
      events.push(...result.events);
    }
    expect(events.filter((e) => e.type === 'finish')).toHaveLength(1);
    expect(state.elapsedS).toBeCloseTo(2, 5);
  });

  it('ne boucle pas indéfiniment sur des étapes de cible nulle', () => {
    const steps = Array.from({ length: 3 }, (_, i) =>
      step({ key: `z${i}`, target: { type: 'time', seconds: 0 } }),
    );
    const result = advance(initialState(), steps, { dtS: 1, dDistanceM: 4, moving: true }, options);
    expect(result.state.finished).toBe(true);
  });
});

describe('temps en mouvement', () => {
  it('n’accumule le temps en mouvement que quand on avance', () => {
    let state = initialState();
    state = advance(state, [], { dtS: 10, dDistanceM: 0, moving: false }, options).state;
    state = advance(state, [], { dtS: 10, dDistanceM: 40, moving: true }, options).state;
    expect(state.elapsedS).toBe(20);
    expect(state.movingS).toBe(10);
  });
});

describe('skipStep', () => {
  it('clôt l’étape en cours sur ce qui a été réellement couru', () => {
    const steps = [
      step({ key: 'a', target: { type: 'distance', meters: 1000 } }),
      step({ key: 'b' }),
    ];
    const { state } = run(steps, 10, 4);
    const skipped = skipStep(state, steps);
    expect(skipped.state.stepIndex).toBe(1);
    expect(skipped.state.laps[0].distanceM).toBeCloseTo(40, 5);
    expect(skipped.events.some((e) => e.type === 'step-start')).toBe(true);
  });
});

describe('stepProgress', () => {
  it('rend une fraction bornée', () => {
    const s = step({ key: 'a', target: { type: 'distance', meters: 400 } });
    expect(stepProgress(s, { stepElapsedS: 0, stepDistanceM: 100 })).toBeCloseTo(0.25, 5);
    expect(stepProgress(s, { stepElapsedS: 0, stepDistanceM: 900 })).toBe(1);
  });
});
