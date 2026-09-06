import { StyleSheet, View } from 'react-native';

import type { Split } from '@/entities/activity/model';
import { formatDuration, formatPace } from '@/shared/lib/format';
import { colors, radius, spacing } from '@/shared/theme';
import { Body, Small } from '@/shared/ui';

type Props = { splits: Split[] };

/**
 * Kilomètres, avec une barre proportionnelle à l'allure. La barre est calée
 * sur le kilomètre le PLUS RAPIDE de la sortie : c'est ce qui fait ressortir
 * la dérive de fin de séance, qu'une échelle absolue écraserait.
 */
export function SplitList({ splits }: Props) {
  if (splits.length === 0) return null;
  const fastest = Math.min(...splits.map((split) => split.paceSecPerKm));
  const slowest = Math.max(...splits.map((split) => split.paceSecPerKm));
  const span = Math.max(1, slowest - fastest);

  return (
    <View style={styles.wrap}>
      {splits.map((split) => {
        // 35 % de largeur minimale : une barre quasi nulle ne se lit pas.
        const ratio = 1 - ((split.paceSecPerKm - fastest) / span) * 0.65;
        return (
          <View key={split.index} style={styles.row}>
            <Small style={styles.index}>{split.index}</Small>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${Math.max(12, ratio * 100)}%`,
                    backgroundColor:
                      split.paceSecPerKm === fastest ? colors.accent : colors.accentDim,
                  },
                ]}
              />
            </View>
            <Body style={styles.pace}>{formatPace(split.paceSecPerKm)}</Body>
            <Small style={styles.time}>{formatDuration(split.durationS)}</Small>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  index: { width: 18, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  bar: { height: 8, borderRadius: radius.pill },
  pace: { width: 52, textAlign: 'right', fontWeight: '700', fontVariant: ['tabular-nums'] },
  time: { width: 54, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
