import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { averagePace } from '@/entities/activity/model';
import { getActivity } from '@/entities/activity/repo';
import { rewardsFor } from '@/features/activity/rewards';
import { ActivityReport } from '@/features/activity/ui/ActivityReport';
import { Celebration } from '@/features/activity/ui/Celebration';
import { Confetti } from '@/features/activity/ui/Confetti';
import { CountUp } from '@/features/activity/ui/CountUp';
import { RewardList } from '@/features/activity/ui/RewardList';
import { usePlanStore } from '@/features/plan/store';
import { fromKey, labelDayFull, toKey } from '@/shared/lib/date';
import { formatDuration, formatKm, formatPace } from '@/shared/lib/format';
import { colors, spacing } from '@/shared/theme';
import { Button, Card, EmptyState, Label, Metric, Screen } from '@/shared/ui';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RunSummary'>;
type SummaryRoute = RouteProp<RootStackParamList, 'RunSummary'>;

/**
 * Bilan de fin de séance, et moment de récompense de l'app.
 *
 * L'ordre est délibéré : d'abord ce qui est arrivé (la distance, en grand),
 * ensuite ce que ça vaut (les records et objectifs), et seulement après les
 * détails (carte, kilomètres, étapes). On célèbre avant d'analyser.
 */
export function RunSummaryScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<SummaryRoute>();
  const settings = usePlanStore((state) => state.settings);
  const workouts = usePlanStore((state) => state.workouts);
  const activities = usePlanStore((state) => state.activities);

  // Relu depuis la base et non depuis la liste en mémoire : celle-ci ne porte
  // pas la trace GPS, et c'est justement la carte qu'on vient voir.
  const activity = useMemo(() => getActivity(params.activityId), [params.activityId]);
  const workout = activity?.workoutId
    ? workouts.find((candidate) => candidate.id === activity.workoutId)
    : undefined;

  const rewards = useMemo(
    () =>
      activity ? rewardsFor({ activity, history: activities, workout, workouts }) : [],
    [activity, activities, workout, workouts],
  );

  if (!activity) {
    return (
      <Screen>
        <EmptyState
          title="Activité introuvable"
          action={<Button label="Retour" onPress={() => navigation.popTo('Tabs')} />}
        />
      </Screen>
    );
  }

  const day = labelDayFull(fromKey(toKey(new Date(activity.startedAt))));

  return (
    <Screen
      scroll
      // Les confettis tombent devant le contenu, en dehors du défilement, et
      // n'interceptent aucun appui (cf. `Confetti`).
      overlay={<Confetti seed={activity.id} />}
    >
      <Celebration
        title={`${formatKm(activity.distanceM, 2)} km`}
        subtitle={`${workout?.name ?? 'Sortie libre'} · ${day}`}
      />

      <Card style={styles.stats}>
        <CountUp value={activity.durationS} format={(value) => formatDuration(value)}>
          {(text) => (
            <View style={styles.stat}>
              <Metric>{text}</Metric>
              <Label>Temps</Label>
            </View>
          )}
        </CountUp>
        <CountUp
          value={averagePace(activity)}
          delay={220}
          // Le compteur d'allure DESCEND : une allure qui monterait depuis zéro
          // afficherait des valeurs aberrantes, alors qu'en partant d'une
          // allure lente elle raconte une accélération. Le départ est borné
          // pour rester dans les valeurs que `formatPace` sait afficher.
          format={(value) => {
            const target = averagePace(activity);
            const from = Math.min(target * 1.6, 20 * 60);
            return formatPace(from - (from - target) * (value / (target || 1)));
          }}
        >
          {(text) => (
            <View style={styles.stat}>
              <Metric>{text}</Metric>
              <Label>Allure /km</Label>
            </View>
          )}
        </CountUp>
        <CountUp
          value={activity.elevGainM}
          delay={320}
          format={(value) => `${Math.round(value)}`}
        >
          {(text) => (
            <View style={styles.stat}>
              <Metric>{text}</Metric>
              <Label>D+ (m)</Label>
            </View>
          )}
        </CountUp>
      </Card>

      <View style={styles.rewards}>
        <RewardList rewards={rewards} />
      </View>

      <ActivityReport activity={activity} zones={settings.zones} variant="summary" />

      <View style={styles.actions}>
        <Button label="Terminé" full onPress={() => navigation.popTo('Tabs')} />
      </View>

    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    backgroundColor: colors.surface,
  },
  stat: { alignItems: 'center', gap: 2 },
  rewards: { paddingVertical: spacing.lg },
  actions: { paddingTop: spacing.xl },
});
