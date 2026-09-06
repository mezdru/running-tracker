import type { Activity, Lap, Split } from '@/entities/activity/model';
import type { Workout } from '@/entities/workout/model';

import { dayStreak, intervalsHeld, rewardsFor } from './rewards';

const DAY = 24 * 3600 * 1000;
const BASE = Date.parse('2026-09-06T08:00:00');

function activity(partial: Partial<Activity> & { id: string }): Activity {
  const distanceM = partial.distanceM ?? 5000;
  const durationS = partial.durationS ?? 1500;
  return {
    workoutId: null,
    startedAt: BASE,
    endedAt: BASE + durationS * 1000,
    distanceM,
    durationS,
    movingS: durationS,
    elevGainM: 0,
    track: [],
    splits: [],
    laps: [],
    stravaActivityId: null,
    stravaSharedAt: null,
    createdAt: BASE,
    ...partial,
  };
}

const split = (index: number, paceSecPerKm: number): Split => ({
  index,
  distanceM: 1000,
  durationS: paceSecPerKm,
  paceSecPerKm,
  elevGainM: 0,
});

const lap = (paceSecPerKm: number, targetPaceSecPerKm: number): Lap => ({
  key: `k${paceSecPerKm}`,
  label: 'Intervalle',
  zoneId: 'z_vma',
  targetPaceSecPerKm,
  distanceM: 400,
  durationS: 90,
  paceSecPerKm,
});

const ids = (rewards: { id: string }[]) => rewards.map((reward) => reward.id);

describe('records', () => {
  it('n’annonce un record de distance que s’il en est un', () => {
    const previous = activity({ id: 'a', distanceM: 8000 });
    const shorter = activity({ id: 'b', distanceM: 6000 });
    expect(ids(rewardsFor({ activity: shorter, history: [previous, shorter], workouts: [] }))).not.toContain(
      'record-distance',
    );

    const longer = activity({ id: 'c', distanceM: 9000 });
    expect(ids(rewardsFor({ activity: longer, history: [previous, longer], workouts: [] }))).toContain(
      'record-distance',
    );
  });

  it('ne compare pas l’effort à lui-même', () => {
    // Sans le filtrage par identifiant, la sortie serait toujours battue par
    // elle-même et aucun record ne sortirait jamais.
    const only = activity({ id: 'a', distanceM: 5000 });
    expect(ids(rewardsFor({ activity: only, history: [only], workouts: [] }))).toContain(
      'record-distance',
    );
  });

  it('ignore l’allure des sorties trop courtes', () => {
    const sprint = activity({ id: 'a', distanceM: 1200, durationS: 240 }); // 3:20/km
    const long = activity({ id: 'b', distanceM: 10000, durationS: 3000 }); // 5:00/km
    const rewards = ids(rewardsFor({ activity: long, history: [sprint, long], workouts: [] }));
    // Le 1,2 km très rapide ne doit pas priver la sortie longue de son record.
    expect(rewards).toContain('record-pace');
  });

  it('récompense le meilleur kilomètre', () => {
    const previous = activity({ id: 'a', splits: [split(1, 300), split(2, 290)] });
    const better = activity({ id: 'b', splits: [split(1, 305), split(2, 280)] });
    expect(ids(rewardsFor({ activity: better, history: [previous, better], workouts: [] }))).toContain(
      'record-split',
    );
  });
});

describe('caps', () => {
  it('ne célèbre un premier 10 km qu’une seule fois', () => {
    const first = activity({ id: 'a', distanceM: 10500 });
    expect(ids(rewardsFor({ activity: first, history: [first], workouts: [] }))).toContain(
      'milestone-10000',
    );

    const second = activity({ id: 'b', distanceM: 11000 });
    expect(ids(rewardsFor({ activity: second, history: [first, second], workouts: [] }))).not.toContain(
      'milestone-10000',
    );
  });

  it('ne décerne que le cap le plus élevé', () => {
    const half = activity({ id: 'a', distanceM: 21500 });
    const rewards = ids(rewardsFor({ activity: half, history: [half], workouts: [] }));
    expect(rewards).toContain('milestone-21097');
    expect(rewards).not.toContain('milestone-10000');
  });
});

describe('dayStreak', () => {
  it('compte les jours civils consécutifs', () => {
    const today = activity({ id: 'd', startedAt: BASE });
    const yesterday = activity({ id: 'c', startedAt: BASE - DAY });
    const before = activity({ id: 'b', startedAt: BASE - 2 * DAY });
    expect(dayStreak(today, [yesterday, before])).toBe(3);
  });

  it('s’arrête au premier jour manqué', () => {
    const today = activity({ id: 'b', startedAt: BASE });
    const gap = activity({ id: 'a', startedAt: BASE - 2 * DAY });
    expect(dayStreak(today, [gap])).toBe(1);
  });
});

describe('intervalsHeld', () => {
  it('tolère un léger retard sur la cible', () => {
    const held = intervalsHeld(
      activity({ id: 'a', laps: [lap(230, 225), lap(220, 225), lap(236, 225)] }),
    );
    expect(held).toEqual({ onTarget: 3, total: 3 });
  });

  it('compte comme manqué un intervalle nettement trop lent', () => {
    const held = intervalsHeld(activity({ id: 'a', laps: [lap(225, 225), lap(260, 225)] }));
    expect(held).toEqual({ onTarget: 1, total: 2 });
  });
});

describe('objectifs du plan', () => {
  const workout: Workout = {
    id: 'w1',
    date: '2026-09-06',
    name: 'Fractionné',
    kind: 'intervals',
    notes: '',
    blocks: [],
    estDistanceM: 10000,
    estDurationS: 3000,
    position: 0,
    done: true,
    createdAt: BASE,
    updatedAt: BASE,
  };

  it('valide une séance bouclée à la distance prévue', () => {
    const done = activity({ id: 'a', workoutId: 'w1', distanceM: 9900 });
    expect(
      ids(rewardsFor({ activity: done, history: [done], workout, workouts: [workout] })),
    ).toContain('goal-distance');
  });

  it('ne valide pas une séance écourtée', () => {
    const short = activity({ id: 'a', workoutId: 'w1', distanceM: 6000 });
    expect(
      ids(rewardsFor({ activity: short, history: [short], workout, workouts: [workout] })),
    ).not.toContain('goal-distance');
  });

  it('salue une semaine entièrement faite', () => {
    const second: Workout = { ...workout, id: 'w2', date: '2026-09-04', done: true };
    const done = activity({ id: 'a', workoutId: 'w1' });
    expect(
      ids(rewardsFor({ activity: done, history: [done], workout, workouts: [workout, second] })),
    ).toContain('goal-week');
  });

  it('ne salue pas une semaine incomplète', () => {
    const pending: Workout = { ...workout, id: 'w2', date: '2026-09-04', done: false };
    const done = activity({ id: 'a', workoutId: 'w1' });
    expect(
      ids(rewardsFor({ activity: done, history: [done], workout, workouts: [workout, pending] })),
    ).not.toContain('goal-week');
  });
});
