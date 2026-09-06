import type { Activity, Lap } from '@/entities/activity/model';
import type { PaceZone } from '@/entities/pace/model';
import type { Workout } from '@/entities/workout/model';

import {
  consistency,
  distributionByKind,
  summarize,
  timeInZones,
  trainingLoad,
  weeklyStats,
} from './compute';

const at = (day: string, hour = 8) => Date.parse(`${day}T0${hour}:00:00`);

function activity(partial: Partial<Activity> & { id: string; day: string }): Activity {
  const { day, ...rest } = partial;
  const distanceM = rest.distanceM ?? 10000;
  const durationS = rest.durationS ?? 3000;
  return {
    workoutId: null,
    startedAt: at(day),
    endedAt: at(day) + durationS * 1000,
    distanceM,
    durationS,
    movingS: durationS,
    elevGainM: 0,
    track: [],
    splits: [],
    laps: [],
    stravaActivityId: null,
    createdAt: at(day),
    ...rest,
  };
}

function workout(partial: Partial<Workout> & { id: string; date: string }): Workout {
  return {
    name: 'Séance',
    kind: 'easy',
    notes: '',
    blocks: [],
    estDistanceM: 10000,
    estDurationS: 3000,
    position: 0,
    done: false,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

// Lundis : 2026-09-07, 2026-09-14, 2026-09-21.
const FROM = '2026-09-07';

describe('weeklyStats', () => {
  it('range chaque séance et chaque sortie dans sa semaine', () => {
    const stats = weeklyStats({
      workouts: [
        workout({ id: 'w1', date: '2026-09-09' }),
        workout({ id: 'w2', date: '2026-09-16' }),
      ],
      activities: [
        activity({ id: 'a1', day: '2026-09-09', distanceM: 8000 }),
        activity({ id: 'a2', day: '2026-09-13', distanceM: 12000 }),
      ],
      fromMonday: FROM,
      weeks: 3,
    });

    expect(stats).toHaveLength(3);
    expect(stats[0].doneM).toBe(20000);
    expect(stats[0].doneSessions).toBe(2);
    expect(stats[0].plannedSessions).toBe(1);
    expect(stats[1].plannedSessions).toBe(1);
    expect(stats[2].doneM).toBe(0);
  });

  it('ignore ce qui tombe hors de la période', () => {
    const stats = weeklyStats({
      workouts: [workout({ id: 'w', date: '2026-08-31' })],
      activities: [activity({ id: 'a', day: '2026-10-05' })],
      fromMonday: FROM,
      weeks: 3,
    });
    expect(stats.every((week) => week.plannedSessions === 0 && week.doneSessions === 0)).toBe(true);
  });

  it('calcule l’évolution d’une semaine à l’autre', () => {
    const stats = weeklyStats({
      workouts: [],
      activities: [
        activity({ id: 'a1', day: '2026-09-09', distanceM: 40000 }),
        activity({ id: 'a2', day: '2026-09-16', distanceM: 50000 }),
      ],
      fromMonday: FROM,
      weeks: 2,
    });
    expect(stats[0].changePercent).toBeNull();
    expect(stats[1].changePercent).toBeCloseTo(25, 5);
  });

  it('ne calcule pas d’évolution depuis une semaine vide', () => {
    // Passer de 0 à 40 km n'est pas « +∞ % » : c'est une reprise, et le
    // pourcentage ne veut rien dire.
    const stats = weeklyStats({
      workouts: [],
      activities: [activity({ id: 'a', day: '2026-09-16', distanceM: 40000 })],
      fromMonday: FROM,
      weeks: 2,
    });
    expect(stats[1].changePercent).toBeNull();
  });

  it('rattache l’objectif du plan à sa semaine', () => {
    const stats = weeklyStats({
      workouts: [],
      activities: [],
      fromMonday: FROM,
      weeks: 2,
      targetsByMonday: { [FROM]: 45000 },
    });
    expect(stats[0].targetM).toBe(45000);
    expect(stats[1].targetM).toBeNull();
  });
});

describe('summarize', () => {
  const activities = [
    activity({ id: 'a1', day: '2026-09-09', distanceM: 10000, durationS: 3000 }),
    activity({ id: 'a2', day: '2026-09-09', distanceM: 5000, durationS: 1500 }),
    activity({ id: 'a3', day: '2026-09-16', distanceM: 21000, durationS: 6300 }),
  ];

  it('additionne la période et pondère l’allure par la distance', () => {
    const stats = weeklyStats({ workouts: [], activities, fromMonday: FROM, weeks: 2 });
    const summary = summarize(stats, activities);
    expect(summary.distanceM).toBe(36000);
    expect(summary.sessions).toBe(3);
    expect(summary.longestRunM).toBe(21000);
    // 10 800 s pour 36 km = 300 s/km, et non la moyenne des allures.
    expect(summary.avgPaceSecPerKm).toBeCloseTo(300, 5);
  });

  it('compte les jours actifs et non les sorties', () => {
    const stats = weeklyStats({ workouts: [], activities, fromMonday: FROM, weeks: 2 });
    expect(summarize(stats, activities).activeDays).toBe(2);
  });

  it('rapporte le réalisé au prévu', () => {
    const stats = weeklyStats({
      workouts: [workout({ id: 'w', date: '2026-09-09', estDistanceM: 40000 })],
      activities: [activity({ id: 'a', day: '2026-09-09', distanceM: 20000 })],
      fromMonday: FROM,
      weeks: 1,
    });
    expect(summarize(stats, [activity({ id: 'a', day: '2026-09-09', distanceM: 20000 })])
      .completionPercent).toBeCloseTo(50, 5);
  });

  it('ne divise pas par zéro quand rien n’est prévu', () => {
    const stats = weeklyStats({ workouts: [], activities: [], fromMonday: FROM, weeks: 1 });
    expect(summarize(stats, []).completionPercent).toBeNull();
  });
});

describe('trainingLoad', () => {
  const today = '2026-09-28';
  const regular = Array.from({ length: 4 }, (_, week) =>
    activity({
      id: `a${week}`,
      day: `2026-09-${String(28 - week * 7).padStart(2, '0')}`,
      distanceM: 40000,
    }),
  );

  it('juge cohérente une charge stable', () => {
    const load = trainingLoad(regular, today);
    expect(load.acuteM).toBe(40000);
    expect(load.chronicM).toBe(40000);
    expect(load.ratio).toBeCloseTo(1, 5);
    expect(load.verdict).toBe('optimal');
  });

  it('signale une hausse brutale', () => {
    const load = trainingLoad(
      [...regular, activity({ id: 'spike', day: today, distanceM: 60000 })],
      today,
    );
    expect(load.ratio).toBeGreaterThan(1.5);
    expect(load.verdict).toBe('risque');
  });

  it('ne conclut pas sur trois semaines d’historique manquantes', () => {
    // Une première sortie après une coupure donnerait mécaniquement un rapport
    // de 4 — une « hausse brutale » qui ne veut rien dire.
    const load = trainingLoad([activity({ id: 'a', day: today })], today);
    expect(load.ratio).toBeNull();
    expect(load.acuteM).toBe(10000);
  });

  it('ne conclut pas non plus sans aucune sortie', () => {
    expect(trainingLoad([], today)).toEqual({
      acuteM: 0,
      chronicM: 0,
      ratio: null,
      verdict: 'repos',
    });
  });
});

describe('répartitions', () => {
  it('sépare les sorties libres des séances planifiées', () => {
    const shares = distributionByKind(
      [
        activity({ id: 'a1', day: '2026-09-09', workoutId: 'w1', distanceM: 12000 }),
        activity({ id: 'a2', day: '2026-09-10', distanceM: 5000 }),
      ],
      [workout({ id: 'w1', date: '2026-09-09', kind: 'intervals' })],
    );
    expect(shares.map((share) => share.kind)).toEqual(['intervals', 'free']);
    expect(shares[0].distanceM).toBe(12000);
  });

  it('additionne le temps passé dans chaque allure', () => {
    const lap = (zoneId: string, durationS: number): Lap => ({
      key: `${zoneId}-${durationS}`,
      label: 'Intervalle',
      zoneId,
      targetPaceSecPerKm: 225,
      distanceM: 400,
      durationS,
      paceSecPerKm: 225,
    });
    const zones = [
      { id: 'z_vma', short: 'VMA', color: '#FF4D4D' },
      { id: 'z_ef', short: 'EF', color: '#34D399' },
    ] as unknown as PaceZone[];

    const shares = timeInZones(
      [
        activity({ id: 'a', day: '2026-09-09', laps: [lap('z_vma', 90), lap('z_ef', 300)] }),
        activity({ id: 'b', day: '2026-09-10', laps: [lap('z_vma', 60)] }),
      ],
      zones,
    );
    expect(shares).toEqual([
      { zoneId: 'z_ef', label: 'EF', color: '#34D399', seconds: 300 },
      { zoneId: 'z_vma', label: 'VMA', color: '#FF4D4D', seconds: 150 },
    ]);
  });
});

describe('consistency', () => {
  it('mesure la plus longue suite de semaines actives', () => {
    const stats = weeklyStats({
      workouts: [],
      activities: [
        activity({ id: 'a1', day: '2026-09-09' }),
        activity({ id: 'a2', day: '2026-09-16' }),
        // Semaine du 21 sautée.
        activity({ id: 'a3', day: '2026-09-30' }),
      ],
      fromMonday: FROM,
      weeks: 4,
    });
    expect(consistency(stats)).toEqual({ activeWeeks: 3, longestWeekStreak: 2 });
  });
});
