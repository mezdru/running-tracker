import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { getActivity } from '@/entities/activity/repo';
import { ActivityReport } from '@/features/activity/ui/ActivityReport';
import { usePlanStore } from '@/features/plan/store';
import { fromKey, labelDayFull, todayKey } from '@/shared/lib/date';
import { spacing } from '@/shared/theme';
import { Button, EmptyState, Label, Screen, Title } from '@/shared/ui';
import { useMemo } from 'react';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RunSummary'>;
type SummaryRoute = RouteProp<RootStackParamList, 'RunSummary'>;

/** Bilan affiché juste après une séance, avant de revenir au plan. */
export function RunSummaryScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<SummaryRoute>();
  const settings = usePlanStore((state) => state.settings);
  const workouts = usePlanStore((state) => state.workouts);

  // Relu depuis la base et non depuis la liste en mémoire : celle-ci ne porte
  // pas la trace GPS, et c'est justement la carte qu'on vient voir.
  const activity = useMemo(() => getActivity(params.activityId), [params.activityId]);
  const workout = activity?.workoutId
    ? workouts.find((candidate) => candidate.id === activity.workoutId)
    : undefined;

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

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Label>{labelDayFull(fromKey(todayKey()))}</Label>
        <Title>{workout?.name ?? 'Sortie libre'}</Title>
      </View>

      <ActivityReport activity={activity} zones={settings.zones} />

      <View style={styles.actions}>
        <Button label="Terminé" full onPress={() => navigation.popTo('Tabs')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.xs },
  actions: { paddingTop: spacing.xl },
});
