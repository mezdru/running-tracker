import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Footprints } from 'lucide-react-native';
import { useMemo } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { averagePace, type Activity } from '@/entities/activity/model';
import { usePlanStore } from '@/features/plan/store';
import { formatDuration, formatKm, formatPace } from '@/shared/lib/format';
import { colors, spacing } from '@/shared/theme';
import { Body, Card, EmptyState, Label, Screen, Small, Stat, Title } from '@/shared/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MONTH_FORMATTER = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const DAY_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** Historique des efforts enregistrés, groupé par mois. */
export function ActivitiesScreen() {
  const navigation = useNavigation<Nav>();
  const activities = usePlanStore((state) => state.activities);
  const workouts = usePlanStore((state) => state.workouts);

  const sections = useMemo(() => {
    const groups = new Map<string, Activity[]>();
    for (const activity of activities) {
      const key = MONTH_FORMATTER.format(new Date(activity.startedAt));
      const list = groups.get(key);
      if (list) list.push(activity);
      else groups.set(key, [activity]);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [activities]);

  const totals = useMemo(() => {
    const distance = activities.reduce((sum, activity) => sum + activity.distanceM, 0);
    const duration = activities.reduce((sum, activity) => sum + activity.durationS, 0);
    return { distance, duration, count: activities.length };
  }, [activities]);

  const nameOf = (activity: Activity) =>
    workouts.find((workout) => workout.id === activity.workoutId)?.name ?? 'Sortie libre';

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(activity) => activity.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Title>Activités</Title>
            {totals.count > 0 ? (
              <Card style={styles.totals}>
                <Stat value={formatKm(totals.distance)} unit="km" label="Total" />
                <Stat value={formatDuration(totals.duration)} label="Temps" />
                <Stat value={String(totals.count)} label="Sorties" />
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Footprints size={28} color={colors.textFaint} />}
            title="Aucune sortie enregistrée"
            hint="Lancez une séance depuis l’onglet Courir : distance, allure et tracé seront enregistrés ici."
          />
        }
        renderSectionHeader={({ section }) => (
          <Label style={styles.sectionTitle}>{section.title.toUpperCase()}</Label>
        )}
        renderItem={({ item }) => (
          <Card
            style={styles.row}
            onPress={() => navigation.navigate('ActivityDetail', { activityId: item.id })}
          >
            <View style={styles.rowTexts}>
              <Body style={styles.rowTitle} numberOfLines={1}>
                {nameOf(item)}
              </Body>
              <Small style={styles.rowDate}>
                {DAY_FORMATTER.format(new Date(item.startedAt))}
              </Small>
            </View>
            <View style={styles.rowMetrics}>
              <Body style={styles.rowDistance}>{formatKm(item.distanceM, 2)} km</Body>
              <Small>
                {formatDuration(item.durationS)} · {formatPace(averagePace(item))} /km
              </Small>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl * 3, gap: spacing.sm },
  header: { paddingTop: spacing.md, paddingBottom: spacing.xs, gap: spacing.lg },
  totals: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { paddingTop: spacing.lg, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowTexts: { flex: 1, gap: 2 },
  rowTitle: { fontWeight: '700' },
  rowDate: { textTransform: 'capitalize' },
  rowMetrics: { alignItems: 'flex-end', gap: 2 },
  rowDistance: { fontWeight: '700' },
});
