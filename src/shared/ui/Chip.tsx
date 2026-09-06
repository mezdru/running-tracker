import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type as typography } from '@/shared/theme';

type Props = {
  label: string;
  color?: string;
  active?: boolean;
  onPress?: () => void;
  compact?: boolean;
};

/** Pastille : allure d'une étape, type de séance, filtre. */
export function Chip({ label, color, active, onPress, compact }: Props) {
  const tint = color ?? colors.textMuted;
  const body = (
    <View
      style={[
        styles.chip,
        compact && styles.compact,
        {
          // Fond teinté à 18 % : lisible sur fond sombre sans écraser le texte.
          backgroundColor: active ? tint : `${tint}22`,
          borderColor: active ? tint : `${tint}55`,
        },
      ]}
    >
      <Text
        style={[
          typography.label,
          { color: active ? colors.accentInk : tint, textTransform: 'uppercase' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  compact: { paddingHorizontal: spacing.sm, paddingVertical: 3 },
});
