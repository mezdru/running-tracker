import { StyleSheet, View } from 'react-native';

import { formatDurationShort, formatKm } from '@/shared/lib/format';
import { colors, radius, spacing } from '@/shared/theme';
import { Card, Label, Small, Stat } from '@/shared/ui';

import type { WeekSummary } from '../store';

type Props = { summary: WeekSummary };

/**
 * Bandeau de totaux d'une semaine. La barre du bas compare le réalisé au
 * prévu : c'est la seule information qui demande un coup d'œil quotidien
 * pendant une préparation, donc elle est lisible sans rien ouvrir.
 */
export function WeekTotals({ summary }: Props) {
  const ratio =
    summary.plannedDistanceM > 0
      ? Math.min(1, summary.doneDistanceM / summary.plannedDistanceM)
      : 0;

  return (
    <Card style={styles.card}>
      <View style={styles.stats}>
        <Stat value={formatKm(summary.plannedDistanceM)} unit="km" label="Prévu" />
        <Stat value={formatDurationShort(summary.plannedDurationS)} label="Durée" />
        <Stat value={String(summary.sessions)} label="Séances" />
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <Label>Réalisé</Label>
          <Small style={styles.done}>
            {formatKm(summary.doneDistanceM)} km · {summary.doneSessions}/{summary.sessions}
          </Small>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  progressBlock: { gap: spacing.sm },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  done: { color: colors.text, fontWeight: '700' },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accent },
});
