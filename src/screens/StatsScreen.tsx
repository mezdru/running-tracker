import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { activePlan, planMondays, type TrainingPlan } from '@/entities/plan/model';
import {
  LOAD_LABEL,
  consistency,
  distributionByKind,
  summarize,
  timeInZones,
  trainingLoad,
  weeklyStats,
  type WeekStat,
} from '@/features/stats/compute';
import { ShareBars } from '@/features/stats/ui/ShareBars';
import { WeeklyBars } from '@/features/stats/ui/WeeklyBars';
import { usePlanStore } from '@/features/plan/store';
import { KIND_COLOR } from '@/entities/workout/display';
import { fromKey, labelWeek, shiftKey, todayKey, weekKey, type DayKey } from '@/shared/lib/date';
import { formatDuration, formatDurationShort, formatKm, formatPace } from '@/shared/lib/format';
import { colors, spacing } from '@/shared/theme';
import { Body, Card, EmptyState, Label, Screen, Segmented, Small, Stat, Title } from '@/shared/ui';

type Period = '8' | '12' | '26' | 'plan';

/** Fenêtre analysée : un nombre de semaines finissant à la semaine en cours. */
function windowFor(period: Period, plan: TrainingPlan | null, today: DayKey) {
  if (period === 'plan' && plan) {
    return { fromMonday: plan.startMonday, weeks: plan.weeks, plan };
  }
  const weeks = Number(period);
  // La semaine en cours est INCLUSE : on veut voir où l'on en est, pas
  // seulement ce qui est terminé.
  const thisMonday = weekKey(fromKey(today));
  return { fromMonday: shiftKey(thisMonday, -(weeks - 1) * 7), weeks, plan: null };
}

export function StatsScreen() {
  const workouts = usePlanStore((state) => state.workouts);
  const activities = usePlanStore((state) => state.activities);
  const plans = usePlanStore((state) => state.plans);
  const settings = usePlanStore((state) => state.settings);

  const today = todayKey();
  const plan = activePlan(plans, today);
  const [period, setPeriod] = useState<Period>(plan ? 'plan' : '12');

  const { fromMonday, weeks, plan: windowPlan } = windowFor(period, plan, today);

  const stats = useMemo<WeekStat[]>(() => {
    const targetsByMonday: Record<DayKey, number> = {};
    if (windowPlan) {
      planMondays(windowPlan).forEach((monday, index) => {
        const target = windowPlan.weeklyTargetsM[index];
        if (target) targetsByMonday[monday] = target;
      });
    }
    return weeklyStats({ workouts, activities, fromMonday, weeks, targetsByMonday });
  }, [workouts, activities, fromMonday, weeks, windowPlan]);

  const summary = useMemo(() => summarize(stats, activities), [stats, activities]);
  const load = useMemo(() => trainingLoad(activities, today), [activities, today]);
  const kinds = useMemo(() => distributionByKind(activities, workouts), [activities, workouts]);
  const zones = useMemo(
    () => timeInZones(activities, settings.zones),
    [activities, settings.zones],
  );
  const regularity = useMemo(() => consistency(stats), [stats]);

  const options: { value: Period; label: string }[] = [
    ...(plan ? [{ value: 'plan' as Period, label: 'Plan' }] : []),
    { value: '8', label: '8 sem.' },
    { value: '12', label: '12 sem.' },
    { value: '26', label: '6 mois' },
  ];

  if (activities.length === 0 && workouts.length === 0) {
    return (
      <Screen scroll>
        <Title style={styles.title}>Statistiques</Title>
        <EmptyState
          title="Rien à analyser pour l’instant"
          hint="Planifiez des séances et enregistrez des sorties : les volumes, l’évolution et la charge apparaîtront ici."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Title style={styles.title}>Statistiques</Title>
      <View style={styles.segmented}>
        <Segmented value={period} onChange={setPeriod} options={options} />
      </View>
      <Small style={styles.range}>
        {labelWeek(fromKey(fromMonday))} → {labelWeek(fromKey(shiftKey(fromMonday, (weeks - 1) * 7)))}
        {windowPlan ? ` · ${windowPlan.name}` : ''}
      </Small>

      <Card style={styles.totals}>
        <Stat value={formatKm(summary.distanceM, 0)} unit="km" label="Volume" />
        <Stat value={formatDurationShort(summary.durationS)} label="Temps" />
        <Stat value={String(summary.sessions)} label="Sorties" />
      </Card>

      <Card style={styles.secondary}>
        <Cell label="Volume / sem." value={`${formatKm(summary.weeklyAverageM, 1)} km`} />
        <Cell label="Allure moy." value={`${formatPace(summary.avgPaceSecPerKm)} /km`} />
        <Cell label="Dénivelé" value={`${Math.round(summary.elevGainM)} m`} />
      </Card>

      <Card style={styles.secondary}>
        <Cell label="Plus longue" value={`${formatKm(summary.longestRunM, 1)} km`} />
        <Cell
          label="Meilleur km"
          value={summary.bestSplitSecPerKm > 0 ? formatPace(summary.bestSplitSecPerKm) : '—'}
        />
        <Cell label="Jours actifs" value={String(summary.activeDays)} />
      </Card>

      <Label style={styles.sectionLabel}>Volume par semaine</Label>
      <Card>
        <WeeklyBars weeks={stats} />
      </Card>

      <Card padded={false} style={styles.weekList}>
        {stats.map((week) => (
          <View key={week.monday} style={styles.weekRow}>
            <Small style={styles.weekLabel}>{labelWeek(fromKey(week.monday))}</Small>
            <Body style={styles.weekValue}>{formatKm(week.doneM, 1)} km</Body>
            <Small style={styles.weekTarget}>
              {week.targetM ? `/ ${formatKm(week.targetM, 0)}` : week.plannedM > 0 ? `/ ${formatKm(week.plannedM, 0)}` : ''}
            </Small>
            <Small style={[styles.weekChange, { color: changeColor(week.changePercent) }]}>
              {formatChange(week.changePercent)}
            </Small>
          </View>
        ))}
      </Card>

      <Label style={styles.sectionLabel}>Charge</Label>
      <Card style={styles.load}>
        <View style={styles.loadHeader}>
          <Body style={styles.loadTitle}>
            {load.ratio == null ? 'Historique insuffisant' : LOAD_LABEL[load.verdict]}
          </Body>
          {load.ratio != null ? (
            <Body style={[styles.loadRatio, { color: loadColor(load.verdict) }]}>
              {load.ratio.toFixed(2).replace('.', ',')}
            </Body>
          ) : null}
        </View>
        <Small>
          {load.ratio == null
            ? 'Il faut environ un mois de sorties pour comparer utilement la semaine écoulée à vos habitudes.'
            : `${formatKm(load.acuteM, 1)} km sur sept jours, pour une habitude de ${formatKm(load.chronicM, 1)} km par semaine. Entre 0,80 et 1,30, la progression reste dans ce que le corps encaisse.`}
        </Small>
      </Card>

      {kinds.length > 0 ? (
        <>
          <Label style={styles.sectionLabel}>Par type de séance</Label>
          <Card>
            <ShareBars
              items={kinds.map((share) => ({
                key: share.kind,
                label: share.label,
                value: share.distanceM,
                color: share.kind === 'free' ? colors.textMuted : KIND_COLOR[share.kind],
                detail: `${formatKm(share.distanceM, 1)} km · ${share.sessions}`,
              }))}
            />
          </Card>
        </>
      ) : null}

      {zones.length > 0 ? (
        <>
          <Label style={styles.sectionLabel}>Temps par allure</Label>
          <Card>
            <ShareBars
              items={zones.map((zone) => ({
                key: zone.zoneId,
                label: zone.label,
                value: zone.seconds,
                color: zone.color,
                detail: formatDuration(zone.seconds),
              }))}
            />
          </Card>
          <Small style={styles.footnote}>
            Mesuré sur les étapes des séances structurées : une sortie libre n’a pas d’étape.
          </Small>
        </>
      ) : null}

      <Label style={styles.sectionLabel}>Régularité</Label>
      <Card style={styles.secondary}>
        <Cell label="Sem. actives" value={`${regularity.activeWeeks}/${stats.length}`} />
        <Cell label="Série" value={`${regularity.longestWeekStreak} sem.`} />
        <Cell
          label="Prévu tenu"
          value={
            summary.completionPercent == null
              ? '—'
              : `${Math.round(summary.completionPercent)} %`
          }
        />
      </Card>
    </Screen>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      {/* Intitulé sur une seule ligne : à deux lignes, la valeur d'une cellule
          descend et ne s'aligne plus avec ses voisines. */}
      <Label numberOfLines={1}>{label}</Label>
      <Body style={styles.cellValue} numberOfLines={1}>
        {value}
      </Body>
    </View>
  );
}

function formatChange(change: number | null): string {
  if (change == null) return '';
  const rounded = Math.round(change);
  return `${rounded > 0 ? '+' : ''}${rounded} %`;
}

/**
 * Une hausse n'est pas bonne en soi : au-delà de 15 % d'une semaine à l'autre,
 * la progression de charge sort de ce qui est habituellement recommandé, et la
 * couleur le dit.
 */
function changeColor(change: number | null): string {
  if (change == null) return colors.textFaint;
  if (change > 25) return colors.danger;
  if (change > 15) return colors.warning;
  if (change < -25) return colors.textMuted;
  return colors.success;
}

function loadColor(verdict: string): string {
  if (verdict === 'risque') return colors.danger;
  if (verdict === 'soutenu') return colors.warning;
  if (verdict === 'optimal') return colors.success;
  return colors.textMuted;
}

const styles = StyleSheet.create({
  title: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  segmented: { paddingBottom: spacing.sm },
  range: { paddingBottom: spacing.lg },
  totals: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  secondary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cell: { gap: 2, flex: 1 },
  cellValue: { fontWeight: '700' },
  sectionLabel: { paddingTop: spacing.xl, paddingBottom: spacing.sm },
  weekList: { marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  weekLabel: { flex: 1 },
  weekValue: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  weekTarget: { width: 52, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  weekChange: { width: 52, textAlign: 'right', fontVariant: ['tabular-nums'] },
  load: { gap: spacing.sm },
  loadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loadTitle: { fontWeight: '700' },
  loadRatio: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  footnote: { paddingTop: spacing.sm },
});
