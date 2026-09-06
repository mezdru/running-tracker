import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { colors, spacing, type as typography } from '@/shared/theme';

type RowProps = {
  label: string;
  hint?: string;
  value?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
};

/** Ligne de réglage ou d'action, avec chevron quand elle mène quelque part. */
export function Row({ label, hint, value, left, right, onPress, danger }: RowProps) {
  const content = (
    <View style={styles.row}>
      {left}
      <View style={styles.texts}>
        <Text style={[typography.body, danger && { color: colors.danger }]}>{label}</Text>
        {hint ? <Text style={[typography.small, styles.hint]}>{hint}</Text> : null}
      </View>
      {value ? <Text style={[typography.small, styles.value]}>{value}</Text> : null}
      {right ?? (onPress ? <ChevronRight size={18} color={colors.textFaint} /> : null)}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}

type ToggleProps = { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void };

export function ToggleRow({ label, hint, value, onChange }: ToggleProps) {
  return (
    <Row
      label={label}
      hint={hint}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ true: colors.accentDim, false: colors.surfaceHi }}
          thumbColor={value ? colors.accent : colors.textFaint}
          accessibilityLabel={label}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  texts: { flex: 1, gap: 2 },
  hint: { color: colors.textMuted },
  value: { color: colors.textMuted },
});
