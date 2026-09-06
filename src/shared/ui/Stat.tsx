import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type as typography } from '@/shared/theme';

type Props = {
  value: string;
  label: string;
  unit?: string;
  color?: string;
  /** `lg` pour les cadrans de course, `md` par défaut. */
  size?: 'md' | 'lg';
  align?: 'left' | 'center';
};

/** Un chiffre et son intitulé : la brique de tous les résumés de l'app. */
export function Stat({ value, label, unit, color, size = 'md', align = 'left' }: Props) {
  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <View style={styles.row}>
        <Text
          style={[
            size === 'lg' ? typography.display : typography.metric,
            { color: color ?? colors.text },
          ]}
        >
          {value}
        </Text>
        {unit ? <Text style={[typography.small, styles.unit]}>{unit}</Text> : null}
      </View>
      <Text style={[typography.label, styles.label]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  unit: { color: colors.textMuted, marginBottom: spacing.sm },
  label: { color: colors.textFaint, marginTop: 2 },
});
