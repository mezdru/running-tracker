import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Pencil } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import {
  PLAN_GOAL_LABEL,
  planEndDate,
  planMondays,
  planTotalM,
} from '@/entities/plan/model';
import { usePlanStore, weekSummary } from '@/features/plan/store';
import { fromKey, labelDayFull, labelWeek, shiftKey, todayKey, weekKey } from '@/shared/lib/date';
import { formatDurationShort, formatKm } from '@/shared/lib/format';
import { colors, radius, spacing } from '@/shared/theme';
import { Body, Button, Card, EmptyState, Label, Screen, Sheet, Small, Stat, Stepper, Title } from '@/shared/ui';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PlanDetail'>;
type DetailRoute = RouteProp<RootStackParamList, 'PlanDetail'>;

export function PlanDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<DetailRoute>();
  const plans = usePlanStore((state) => state.plans);
  const workouts = usePlanStore((state) => state.workouts);
  const activities = usePlanStore((state) => state.activities);
  const upsertPlan = usePlanStore((state) => state.upsertPlan);

  const plan = plans.find((candidate) => candidate.id === params.planId);
  const [editing, setEditing] = useState<number | null>(null);

  const today = todayKey();
  const currentMonday = weekKey(fromKey(today));

  const weeks = useMemo(() => {
    if (!plan) return [];
    return planMondays(plan).map((monday, index) => ({
      monday,
      index,
      targetM: plan.weeklyTargetsM[index] ?? 0,
      summary: weekSummary(workouts, activities, monday),
    }));
  }, [plan, workouts, activities]);

  if (!plan) {
    return (
      <Screen>
        <EmptyState
          title="Plan introuvable"
          action={<Button label="Retour" onPress={() => navigation.goBack()} />}
        />
      </Screen>
    );
  }

  const totalTarget = planTotalM(plan);
  const totalDone = weeks.reduce((sum, week) => sum + week.summary.doneDistanceM, 0);
  const totalPlanned = weeks.reduce((sum, week) => sum + week.summary.plannedDistanceM, 0);

  const setTarget = (index: number, meters: number) => {
    const weeklyTargetsM = [...plan.weeklyTargetsM];
    weeklyTargetsM[index] = meters;
    upsertPlan({ ...plan, weeklyTargetsM, updatedAt: Date.now() });
  };

  const shift = (weeksDelta: number) =>
    upsertPlan({
      ...plan,
      startMonday: shiftKey(plan.startMonday, weeksDelta * 7),
      // La date de course suit le plan : décaler l'un sans l'autre produirait
      // un affûtage qui ne tombe plus sur la course.
      raceDate: plan.raceDate ? shiftKey(plan.raceDate, weeksDelta * 7) : null,
      updatedAt: Date.now(),
    });

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={20} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('PlanBuilder', { planId: plan.id })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Modifier le cadre du plan"
        >
          <Pencil size={18} color={colors.text} />
        </Pressable>
      </View>

      <Label>{PLAN_GOAL_LABEL[plan.goal]}</Label>
      <Title style={styles.title}>{plan.name}</Title>
      <Small style={styles.dates}>
        {labelWeek(fromKey(plan.startMonday))} → {labelWeek(fromKey(shiftKey(plan.startMonday, (plan.weeks - 1) * 7)))}
        {plan.raceDate ? ` · course le ${labelDayFull(fromKey(plan.raceDate))}` : ''}
      </Small>

      <Card style={styles.totals}>
        <Stat value={String(plan.weeks)} label="Semaines" />
        <Stat value={formatKm(totalTarget, 0)} unit="km" label="Objectif" />
        <Stat value={formatKm(totalDone, 0)} unit="km" label="Réalisé" />
      </Card>

      <Card style={styles.progress}>
        <View style={styles.progressHeader}>
          <Label>Avancement</Label>
          <Small style={styles.progressValue}>
            {totalTarget > 0 ? `${Math.round((totalDone / totalTarget) * 100)} %` : '—'}
          </Small>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(100, totalTarget > 0 ? (totalDone / totalTarget) * 100 : 0)}%` },
            ]}
          />
        </View>
        <Small>
          {formatKm(totalPlanned, 0)} km de séances posées sur {formatKm(totalTarget, 0)} km visés.
        </Small>
      </Card>

      <Label style={styles.sectionLabel}>Semaines</Label>
      <Card padded={false} style={styles.weeks}>
        {weeks.map((week) => {
          const isCurrent = week.monday === currentMonday;
          const ratio = week.targetM > 0 ? week.summary.doneDistanceM / week.targetM : 0;
          return (
            <Pressable
              key={week.monday}
              onPress={() => setEditing(week.index)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.weekRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={styles.weekHead}>
                <Body style={[styles.weekTitle, isCurrent && { color: colors.accent }]}>
                  S{week.index + 1}
                </Body>
                <Small style={styles.weekDates}>{labelWeek(fromKey(week.monday))}</Small>
                <Small style={styles.weekTarget}>{formatKm(week.targetM, 0)} km</Small>
              </View>
              <View style={styles.weekTrack}>
                <View
                  style={[
                    styles.weekPlanned,
                    {
                      width: `${Math.min(100, week.targetM > 0 ? (week.summary.plannedDistanceM / week.targetM) * 100 : 0)}%`,
                    },
                  ]}
                />
                <View
                  style={[styles.weekDone, { width: `${Math.min(100, ratio * 100)}%` }]}
                />
              </View>
              <Small style={styles.weekFoot}>
                {formatKm(week.summary.plannedDistanceM, 1)} km posés ·{' '}
                {formatKm(week.summary.doneDistanceM, 1)} km courus ·{' '}
                {formatDurationShort(week.summary.plannedDurationS)}
              </Small>
            </Pressable>
          );
        })}
      </Card>

      <View style={styles.actions}>
        <Button label="Décaler d’une semaine →" variant="secondary" full onPress={() => shift(1)} />
        <Button label="← Avancer d’une semaine" variant="secondary" full onPress={() => shift(-1)} />
        <Button
          label="Supprimer le plan"
          variant="danger"
          full
          onPress={() =>
            Alert.alert(
              'Supprimer le plan',
              'Les séances déjà saisies restent au calendrier : seul le cadre est supprimé.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Supprimer',
                  style: 'destructive',
                  onPress: () => {
                    usePlanStore.getState().removePlan(plan.id);
                    navigation.goBack();
                  },
                },
              ],
            )
          }
        />
      </View>

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing !== null ? `Objectif de la semaine ${editing + 1}` : ''}
        scroll={false}
      >
        {editing !== null ? (
          <View style={styles.sheet}>
            <Small>{labelWeek(fromKey(planMondays(plan)[editing]))}</Small>
            <Stepper
              value={plan.weeklyTargetsM[editing] ?? 0}
              onChange={(meters) => setTarget(editing, meters)}
              step={1000}
              min={0}
              max={250000}
              format={(value) => (value === 0 ? 'Aucun objectif' : `${formatKm(value, 0)} km`)}
            />
          </View>
        ) : null}
      </Sheet>

      <Small style={styles.footnote}>
        Le plan se termine le {labelDayFull(fromKey(planEndDate(plan)))}.
      </Small>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { paddingTop: 2 },
  dates: { paddingTop: spacing.xs, paddingBottom: spacing.lg },
  totals: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  progress: { gap: spacing.sm },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressValue: { color: colors.text, fontWeight: '700' },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accent },
  sectionLabel: { paddingTop: spacing.xl, paddingBottom: spacing.sm },
  weeks: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  weekRow: { paddingVertical: spacing.md, gap: 6 },
  weekHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  weekTitle: { fontWeight: '800', width: 30 },
  weekDates: { flex: 1 },
  weekTarget: { color: colors.warning, fontWeight: '700' },
  weekTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  weekPlanned: { position: 'absolute', height: 8, backgroundColor: colors.surfaceHi },
  weekDone: { position: 'absolute', height: 8, backgroundColor: colors.accent },
  weekFoot: { color: colors.textFaint },
  actions: { gap: spacing.sm, paddingTop: spacing.xl },
  sheet: { gap: spacing.md, paddingBottom: spacing.lg },
  footnote: { paddingTop: spacing.lg },
});
