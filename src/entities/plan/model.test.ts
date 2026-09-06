import {
  DEFAULT_SHAPE,
  activePlan,
  planCovers,
  planEndDate,
  planMondays,
  weeklyTargets,
  type TrainingPlan,
} from './model';

const plan = (overrides: Partial<TrainingPlan> = {}): TrainingPlan => ({
  id: 'p1',
  name: 'Semi',
  goal: 'semi',
  startMonday: '2026-09-07',
  weeks: 12,
  raceDate: null,
  weeklyTargetsM: [],
  notes: '',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('weeklyTargets', () => {
  it('produit exactement une valeur par semaine', () => {
    expect(weeklyTargets({ ...DEFAULT_SHAPE, weeks: 12 })).toHaveLength(12);
    expect(weeklyTargets({ ...DEFAULT_SHAPE, weeks: 4 })).toHaveLength(4);
  });

  it('fait monter la charge entre deux semaines de charge', () => {
    const targets = weeklyTargets({
      ...DEFAULT_SHAPE,
      weeks: 3,
      recoveryEvery: 0,
      taperWeeks: 0,
      startVolumeM: 30000,
      progressionPercent: 10,
    });
    expect(targets).toEqual([30000, 33000, 36500]);
  });

  it('allège la semaine d’assimilation sans casser la progression', () => {
    const targets = weeklyTargets({
      ...DEFAULT_SHAPE,
      weeks: 5,
      recoveryEvery: 4,
      recoveryDropPercent: 30,
      taperWeeks: 0,
      startVolumeM: 30000,
      progressionPercent: 10,
    });
    // Semaines 1-3 en montée, semaine 4 allégée, semaine 5 qui REPART du
    // niveau atteint (39 930) et non du niveau allégé.
    expect(targets[3]).toBeLessThan(targets[2]);
    expect(targets[4]).toBeGreaterThan(targets[2]);
  });

  it('fait décroître l’affûtage jusqu’à la course', () => {
    const targets = weeklyTargets({ ...DEFAULT_SHAPE, weeks: 10, taperWeeks: 3 });
    const taper = targets.slice(-3);
    expect(taper[0]).toBeGreaterThan(taper[1]);
    expect(taper[1]).toBeGreaterThan(taper[2]);
  });

  it('calcule l’affûtage sur le PIC et non sur la dernière semaine', () => {
    // Affûtage placé juste après une semaine d'assimilation : s'il partait de
    // la semaine précédente, il serait ridiculement bas.
    const targets = weeklyTargets({
      ...DEFAULT_SHAPE,
      weeks: 5,
      recoveryEvery: 4,
      taperWeeks: 1,
      startVolumeM: 30000,
      progressionPercent: 10,
    });
    const peak = Math.max(...targets.slice(0, 4));
    // Une semaine d'affûtage seule = semaine de course, à la moitié du pic.
    expect(targets[4]).toBe(Math.round((peak * 0.5) / 500) * 500);
  });

  it('ne produit pas de plan entièrement en affûtage', () => {
    // L'affûtage est borné : il reste toujours au moins une semaine de charge.
    const targets = weeklyTargets({ ...DEFAULT_SHAPE, weeks: 3, taperWeeks: 9 });
    expect(targets).toHaveLength(3);
    expect(targets[0]).toBe(30000);
  });

  it('supporte un plan d’une seule semaine', () => {
    expect(weeklyTargets({ ...DEFAULT_SHAPE, weeks: 1 })).toHaveLength(1);
  });
});

describe('bornes du plan', () => {
  it('se termine le dimanche de la dernière semaine', () => {
    expect(planEndDate(plan({ startMonday: '2026-09-07', weeks: 2 }))).toBe('2026-09-20');
  });

  it('couvre ses propres dates et pas les autres', () => {
    const p = plan({ startMonday: '2026-09-07', weeks: 2 });
    expect(planCovers(p, '2026-09-07')).toBe(true);
    expect(planCovers(p, '2026-09-20')).toBe(true);
    expect(planCovers(p, '2026-09-21')).toBe(false);
    expect(planCovers(p, '2026-09-06')).toBe(false);
  });

  it('liste ses lundis dans l’ordre', () => {
    expect(planMondays(plan({ startMonday: '2026-09-07', weeks: 3 }))).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ]);
  });
});

describe('activePlan', () => {
  const past = plan({ id: 'past', startMonday: '2026-06-01', weeks: 4 });
  const current = plan({ id: 'current', startMonday: '2026-09-07', weeks: 4 });
  const future = plan({ id: 'future', startMonday: '2026-12-07', weeks: 4 });

  it('préfère le plan qui couvre aujourd’hui', () => {
    expect(activePlan([past, current, future], '2026-09-10')?.id).toBe('current');
  });

  it('retombe sur le prochain plan à venir', () => {
    // Entre deux plans, c'est celui qui arrive qui compte : on prépare la
    // semaine d'avant.
    expect(activePlan([past, future], '2026-09-10')?.id).toBe('future');
  });

  it('rend null quand il n’y a que du passé', () => {
    expect(activePlan([past], '2026-09-10')).toBeNull();
  });
});
