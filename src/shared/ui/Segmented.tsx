import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type as typography } from '@/shared/theme';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** Sélecteur segmenté : bascule Mois/Semaine, distance/durée, type de cible. */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.item, active && styles.itemActive]}
          >
            <Text
              style={[
                typography.small,
                { color: active ? colors.accentInk : colors.textMuted, fontWeight: '700' },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 3,
    gap: 3,
  },
  item: {
    flex: 1,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  itemActive: { backgroundColor: colors.accent },
});
