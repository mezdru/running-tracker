// Récompenses de fin de séance.
//
// Le principe : ce qui est célébré doit être VRAI et mérité. Une app qui
// félicite à chaque sortie ne récompense plus rien — le confetti devient du
// papier peint. On compare donc chaque effort à tout l'historique et au plan,
// et on ne décerne que ce qui est réellement un progrès : un record, un cap
// franchi pour la première fois, une semaine tenue.
//
// Fonctions pures : elles reçoivent l'historique et rendent une liste. Cela
// permet de les tester, et surtout de vérifier qu'un record ne peut pas être
// annoncé deux fois.
import { addDays } from 'date-fns';

import { averagePace, type Activity } from '@/entities/activity/model';
import type { Workout } from '@/entities/workout/model';
import { formatDuration, formatKm, formatPace } from '@/shared/lib/format';
import { fromKey, toKey, weekDays, weekKey, weekStart } from '@/shared/lib/date';

export type RewardTier = 'record' | 'milestone' | 'goal';

export type Reward = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  tier: RewardTier;
};

/** Caps symboliques, du premier 5 km au marathon. */
const MILESTONES: { meters: number; label: string }[] = [
  { meters: 5000, label: '5 km' },
  { meters: 10000, label: '10 km' },
  { meters: 15000, label: '15 km' },
  { meters: 21097, label: 'semi-marathon' },
  { meters: 30000, label: '30 km' },
  { meters: 42195, label: 'marathon' },
];

/** En dessous, une allure moyenne ne veut pas dire grand-chose. */
const MIN_PACE_RECORD_M = 3000;

/** Tolérance d'allure pour juger qu'un intervalle a été tenu (s/km). */
const HELD_TOLERANCE_S = 12;

export type RewardInput = {
  /** L'effort qui vient de se terminer. */
  activity: Activity;
  /** Historique COMPLET, celui-ci inclus ou non — il est filtré par identifiant. */
  history: Activity[];
  /** Séance du plan associée, si l'effort en suivait une. */
  workout?: Workout;
  /** Plan complet, pour juger de la semaine. */
  workouts: Workout[];
};

export function rewardsFor({ activity, history, workout, workouts }: RewardInput): Reward[] {
  // L'effort courant ne se compare pas à lui-même : sans cela, tout serait un
  // record dès la première comparaison.
  const previous = history.filter((item) => item.id !== activity.id);
  const rewards: Reward[] = [];

  // --- Records -------------------------------------------------------------

  const longest = Math.max(0, ...previous.map((item) => item.distanceM));
  if (activity.distanceM > longest && activity.distanceM >= 1000) {
    rewards.push({
      id: 'record-distance',
      icon: '🏁',
      title: 'Record de distance',
      detail:
        longest > 0
          ? `${formatKm(activity.distanceM, 2)} km, soit ${formatKm(activity.distanceM - longest, 2)} km de plus que votre meilleure sortie`
          : `${formatKm(activity.distanceM, 2)} km — votre première sortie enregistrée`,
      tier: 'record',
    });
  }

  const pace = averagePace(activity);
  if (activity.distanceM >= MIN_PACE_RECORD_M && pace > 0) {
    const comparable = previous.filter((item) => item.distanceM >= MIN_PACE_RECORD_M);
    const best = comparable.reduce(
      (fastest, item) => {
        const value = averagePace(item);
        return value > 0 && value < fastest ? value : fastest;
      },
      Number.POSITIVE_INFINITY,
    );
    if (pace < best) {
      rewards.push({
        id: 'record-pace',
        icon: '⚡️',
        title: 'Record d’allure moyenne',
        detail: Number.isFinite(best)
          ? `${formatPace(pace)} /km, ${Math.round(best - pace)} s/km plus vite que votre référence`
          : `${formatPace(pace)} /km sur ${formatKm(activity.distanceM, 1)} km`,
        tier: 'record',
      });
    }
  }

  const fastestSplit = activity.splits.reduce(
    (fastest, split) => (split.paceSecPerKm > 0 && split.paceSecPerKm < fastest ? split.paceSecPerKm : fastest),
    Number.POSITIVE_INFINITY,
  );
  const previousBestSplit = previous.reduce((fastest, item) => {
    for (const split of item.splits) {
      if (split.paceSecPerKm > 0 && split.paceSecPerKm < fastest) fastest = split.paceSecPerKm;
    }
    return fastest;
  }, Number.POSITIVE_INFINITY);
  if (Number.isFinite(fastestSplit) && fastestSplit < previousBestSplit) {
    rewards.push({
      id: 'record-split',
      icon: '🚀',
      title: 'Meilleur kilomètre',
      detail: `${formatPace(fastestSplit)} sur un kilomètre entier`,
      tier: 'record',
    });
  }

  // --- Caps franchis -------------------------------------------------------

  for (const milestone of [...MILESTONES].reverse()) {
    if (activity.distanceM < milestone.meters) continue;
    const alreadyDone = previous.some((item) => item.distanceM >= milestone.meters);
    if (alreadyDone) break;
    rewards.push({
      id: `milestone-${milestone.meters}`,
      icon: '🏅',
      title: `Premier ${milestone.label}`,
      detail: `Distance franchie pour la première fois, en ${formatDuration(activity.durationS)}`,
      tier: 'milestone',
    });
    break;
  }

  // --- Régularité ----------------------------------------------------------

  const streak = dayStreak(activity, previous);
  if (streak >= 2) {
    rewards.push({
      id: 'streak',
      icon: '🔥',
      title: `${streak} jours d’affilée`,
      detail: 'Série en cours — la régularité fait plus que les grosses séances',
      tier: 'goal',
    });
  }

  const week = weekVolume(activity, previous, history);
  if (week.isRecord && week.meters > 0) {
    rewards.push({
      id: 'record-week',
      icon: '📈',
      title: 'Semaine la plus longue',
      detail: `${formatKm(week.meters, 1)} km cette semaine, votre plus gros volume`,
      tier: 'record',
    });
  }

  // --- Le plan tenu --------------------------------------------------------

  if (workout) {
    if (activity.distanceM >= workout.estDistanceM * 0.97 && workout.estDistanceM > 0) {
      rewards.push({
        id: 'goal-distance',
        icon: '✅',
        title: 'Séance bouclée comme prévu',
        detail: `${formatKm(activity.distanceM, 2)} km pour ${formatKm(workout.estDistanceM, 2)} km planifiés`,
        tier: 'goal',
      });
    }

    const held = intervalsHeld(activity);
    if (held.total >= 3 && held.onTarget === held.total) {
      rewards.push({
        id: 'goal-intervals',
        icon: '🎯',
        title: 'Tous les intervalles tenus',
        detail: `${held.total} répétitions dans la cible, à moins de ${HELD_TOLERANCE_S} s/km près`,
        tier: 'goal',
      });
    }

    if (isWeekComplete(workout, workouts)) {
      rewards.push({
        id: 'goal-week',
        icon: '💯',
        title: 'Semaine complète',
        detail: 'Toutes les séances prévues cette semaine ont été faites',
        tier: 'goal',
      });
    }
  }

  return rewards;
}

/** Jours civils consécutifs, en remontant depuis l'effort, avec au moins une sortie. */
export function dayStreak(activity: Activity, previous: Activity[]): number {
  const days = new Set(previous.map((item) => toKey(new Date(item.startedAt))));
  let streak = 1;
  let cursor = addDays(new Date(activity.startedAt), -1);
  // 400 : borne de sécurité, une série ne peut pas dépasser un an de données.
  while (streak < 400 && days.has(toKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Volume de la semaine de l'effort, et s'il dépasse toutes les autres. */
function weekVolume(activity: Activity, previous: Activity[], history: Activity[]) {
  const week = weekKey(new Date(activity.startedAt));
  const byWeek = new Map<string, number>();
  for (const item of history) {
    const key = weekKey(new Date(item.startedAt));
    byWeek.set(key, (byWeek.get(key) ?? 0) + item.distanceM);
  }
  // L'effort courant peut ne pas être encore dans l'historique fourni.
  if (!history.some((item) => item.id === activity.id)) {
    byWeek.set(week, (byWeek.get(week) ?? 0) + activity.distanceM);
  }

  const meters = byWeek.get(week) ?? 0;
  const others = [...byWeek.entries()].filter(([key]) => key !== week).map(([, value]) => value);
  const hadPrevious = previous.length > 0;
  return { meters, isRecord: hadPrevious && meters > Math.max(0, ...others) };
}

/** Intervalles courus dans la tolérance d'allure de leur cible. */
export function intervalsHeld(activity: Activity): { onTarget: number; total: number } {
  const intervals = activity.laps.filter(
    (lap) => lap.targetPaceSecPerKm != null && lap.paceSecPerKm > 0 && lap.distanceM >= 100,
  );
  const onTarget = intervals.filter(
    (lap) => lap.paceSecPerKm - (lap.targetPaceSecPerKm as number) <= HELD_TOLERANCE_S,
  ).length;
  return { onTarget, total: intervals.length };
}

/** Toutes les séances planifiées de la semaine sont-elles cochées ? */
function isWeekComplete(workout: Workout, workouts: Workout[]): boolean {
  // `weekDays` attend un lundi ; passer la date de la séance telle quelle
  // décalerait la fenêtre de plusieurs jours.
  const days = new Set(weekDays(weekStart(fromKey(workout.date))).map(toKey));
  const inWeek = workouts.filter((item) => days.has(item.date));
  return inWeek.length > 1 && inWeek.every((item) => item.done);
}
