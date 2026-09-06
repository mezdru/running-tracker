import { DEFAULT_SETTINGS } from '@/entities/settings/model';
import { makeStep, repeatBlock, singleBlock } from '@/entities/workout/model';

import { usePlanStore, weekSummary } from './store';

// La base est simulée (cf. jest.setup.js) : le magasin travaille alors
// entièrement en mémoire, ce qui est exactement ce qu'on veut tester ici — la
// copie de semaine, la duplication et le recalcul des estimations.
function reset() {
  usePlanStore.setState({
    ready: true,
    settings: DEFAULT_SETTINGS,
    workouts: [],
    activities: [],
    clipboard: null,
  });
}

/** Séance d'une heure en endurance fondamentale, posée à la date donnée. */
function easyHour(date: string, name = 'Footing') {
  return usePlanStore.getState().createWorkout({
    date,
    name,
    kind: 'easy',
    blocks: [
      singleBlock(
        makeStep({ kind: 'run', zoneId: 'z_ef', target: { type: 'time', seconds: 3600 } }),
      ),
    ],
  });
}

beforeEach(reset);

describe('estimations', () => {
  it('déduit la distance de l’allure de la zone', () => {
    // VMA 16 km/h, EF à 70 % → 11,2 km/h → 11,2 km en une heure.
    const workout = easyHour('2026-09-07');
    expect(Math.round(workout.estDistanceM)).toBe(11200);
    expect(workout.estDurationS).toBe(3600);
  });

  it('recalcule tout le plan quand la VMA change', () => {
    easyHour('2026-09-07');
    usePlanStore.getState().updateSettings({ vmaKmh: 20 });
    // 70 % de 20 km/h = 14 km/h.
    expect(Math.round(usePlanStore.getState().workouts[0].estDistanceM)).toBe(14000);
  });
});

describe('copie de semaine', () => {
  it('reporte les séances sur la semaine cible en régénérant les identifiants', () => {
    const monday = easyHour('2026-09-07', 'Lundi');
    easyHour('2026-09-09', 'Mercredi');

    const store = usePlanStore.getState();
    expect(store.copyWeek('2026-09-07')).toBe(2);
    expect(usePlanStore.getState().pasteWeek('2026-09-14', 'merge')).toBe(2);

    const workouts = usePlanStore.getState().workouts;
    expect(workouts).toHaveLength(4);
    const pasted = workouts.filter((w) => w.date >= '2026-09-14');
    expect(pasted.map((w) => w.date).sort()).toEqual(['2026-09-14', '2026-09-16']);

    // Identifiants neufs, séance ET étapes : sans cela l'éditeur modifierait
    // l'original en même temps que la copie.
    const copy = pasted.find((w) => w.name === 'Lundi');
    expect(copy?.id).not.toBe(monday.id);
    const originalStep = monday.blocks[0];
    const copiedStep = copy?.blocks[0];
    expect(copiedStep?.id).not.toBe(originalStep.id);
    if (originalStep.type === 'single' && copiedStep?.type === 'single') {
      expect(copiedStep.step.id).not.toBe(originalStep.step.id);
    }
  });

  it('ne recopie pas l’état « fait »', () => {
    const workout = easyHour('2026-09-07');
    usePlanStore.getState().toggleDone(workout.id);
    usePlanStore.getState().copyWeek('2026-09-07');
    usePlanStore.getState().pasteWeek('2026-09-14', 'merge');
    const pasted = usePlanStore.getState().workouts.find((w) => w.date === '2026-09-14');
    expect(pasted?.done).toBe(false);
  });

  it('remplace le contenu existant en mode « remplacer »', () => {
    easyHour('2026-09-07', 'Source');
    easyHour('2026-09-14', 'À écraser');
    usePlanStore.getState().copyWeek('2026-09-07');
    usePlanStore.getState().pasteWeek('2026-09-14', 'replace');

    const target = usePlanStore.getState().workouts.filter((w) => w.date >= '2026-09-14');
    expect(target).toHaveLength(1);
    expect(target[0].name).toBe('Source');
  });

  it('empile les séances du même jour en mode « ajouter »', () => {
    easyHour('2026-09-07', 'Source');
    easyHour('2026-09-14', 'Déjà là');
    usePlanStore.getState().copyWeek('2026-09-07');
    usePlanStore.getState().pasteWeek('2026-09-14', 'merge');

    const target = usePlanStore.getState().workouts.filter((w) => w.date === '2026-09-14');
    expect(target).toHaveLength(2);
    // Les rangs sont réattribués : la séance collée passe derrière l'existante.
    expect(target.map((w) => w.position).sort()).toEqual([0, 1]);
  });

  it('ne colle rien sans copie préalable', () => {
    expect(usePlanStore.getState().pasteWeek('2026-09-14', 'merge')).toBe(0);
  });
});

describe('duplication et déplacement', () => {
  it('duplique une séance avec des étapes indépendantes', () => {
    const source = usePlanStore.getState().createWorkout({
      date: '2026-09-07',
      name: 'Fractionné',
      kind: 'intervals',
      blocks: [
        repeatBlock(4, [
          makeStep({ kind: 'interval', zoneId: 'z_vma', target: { type: 'distance', meters: 400 } }),
          makeStep({ kind: 'recovery', zoneId: 'z_recup', target: { type: 'time', seconds: 60 } }),
        ]),
      ],
    });
    const copy = usePlanStore.getState().duplicateWorkout(source.id, '2026-09-14');
    expect(copy).not.toBeNull();
    expect(copy?.date).toBe('2026-09-14');
    expect(copy?.estDistanceM).toBeCloseTo(source.estDistanceM, 5);

    const sourceBlock = source.blocks[0];
    const copyBlock = copy!.blocks[0];
    if (sourceBlock.type === 'repeat' && copyBlock.type === 'repeat') {
      const sourceIds = sourceBlock.steps.map((s) => s.id);
      expect(copyBlock.steps.some((s) => sourceIds.includes(s.id))).toBe(false);
    }
  });

  it('décale tout le plan à partir d’une semaine', () => {
    easyHour('2026-09-01', 'Avant');
    easyHour('2026-09-07', 'Après');
    usePlanStore.getState().shiftPlan('2026-09-07', 1);

    const dates = usePlanStore.getState().workouts.map((w) => w.date).sort();
    expect(dates).toEqual(['2026-09-01', '2026-09-14']);
  });

  it('vide une semaine sans toucher aux autres', () => {
    easyHour('2026-09-07');
    easyHour('2026-09-14');
    expect(usePlanStore.getState().clearWeek('2026-09-07')).toBe(1);
    expect(usePlanStore.getState().workouts.map((w) => w.date)).toEqual(['2026-09-14']);
  });
});

describe('weekSummary', () => {
  it('additionne le prévu et distingue le réalisé mesuré', () => {
    const first = easyHour('2026-09-07');
    easyHour('2026-09-09');
    usePlanStore.getState().toggleDone(first.id);

    const { workouts, activities } = usePlanStore.getState();
    const summary = weekSummary(workouts, activities, '2026-09-07');
    expect(summary.sessions).toBe(2);
    expect(Math.round(summary.plannedDistanceM)).toBe(22400);
    expect(summary.doneSessions).toBe(1);
    // Sans activité enregistrée, le réalisé retombe sur l'estimation.
    expect(Math.round(summary.doneDistanceM)).toBe(11200);
  });

  it('préfère la distance mesurée à l’estimation', () => {
    const workout = easyHour('2026-09-07');
    usePlanStore.getState().addActivity({
      id: 'act_1',
      workoutId: workout.id,
      startedAt: Date.parse('2026-09-07T08:00:00Z'),
      endedAt: Date.parse('2026-09-07T09:00:00Z'),
      distanceM: 10500,
      durationS: 3600,
      movingS: 3600,
      elevGainM: 0,
      track: [],
      splits: [],
      laps: [],
      stravaActivityId: null,
      createdAt: Date.now(),
    });

    const { workouts, activities } = usePlanStore.getState();
    const summary = weekSummary(workouts, activities, '2026-09-07');
    expect(summary.doneDistanceM).toBe(10500);
  });
});

describe('zones', () => {
  it('inclut la marche, en allure absolue', () => {
    const walk = DEFAULT_SETTINGS.zones.find((zone) => zone.id === 'z_marche');
    expect(walk).toBeDefined();
    // Marcher ne va pas plus vite parce qu'on progresse en course : la zone ne
    // doit surtout pas suivre la VMA.
    expect(walk?.mode).toBe('pace');
  });

  it('estime une récupération marchée à une distance de marcheur', () => {
    const workout = usePlanStore.getState().createWorkout({
      date: '2026-09-07',
      name: 'Fractionné',
      kind: 'intervals',
      blocks: [
        repeatBlock(10, [
          makeStep({ kind: 'interval', zoneId: 'z_vma', target: { type: 'time', seconds: 60 } }),
          makeStep({ kind: 'walk', zoneId: 'z_marche', target: { type: 'time', seconds: 60 } }),
        ]),
      ],
    });
    // 10 × (1 min à VMA 16 km/h = 267 m + 1 min de marche à 9:00/km = 111 m).
    expect(Math.round(workout.estDistanceM)).toBe(3778);
  });
});
