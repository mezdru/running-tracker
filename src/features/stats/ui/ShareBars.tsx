import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme';
import { Body, Small } from '@/shared/ui';

type Item = { key: string; label: string; value: number; color?: string; detail: string };

type Props = { items: Item[] };

/**
 * Répartition en barres proportionnelles. Chaque barre est rapportée au PLUS
 * GRAND poste et non au total : sur cinq catégories, des barres rapportées au
 * total seraient toutes minuscules et illisibles.
 */
export function ShareBars({ items }: Props) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <View key={item.key} style={styles.row}>
          <View style={styles.header}>
            <Body style={styles.label} numberOfLines={1}>
              {item.label}
            </Body>
            <Small style={styles.detail}>{item.detail}</Small>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(2, (item.value / max) * 100)}%`,
                  backgroundColor: item.color ?? colors.accent,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { gap: 6 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { flex: 1, fontWeight: '600' },
  detail: { color: colors.textMuted },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: radius.pill },
});
