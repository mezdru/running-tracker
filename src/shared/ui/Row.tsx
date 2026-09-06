import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { colors, spacing } from '@/shared/theme';

import { Body, Small } from './Text';

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
        <Body color={danger ? colors.danger : undefined}>{label}</Body>
        {hint ? <Small>{hint}</Small> : null}
      </View>
      {/* La valeur ne se comprime pas et ne se coupe pas : c'est elle qu'on
          vient lire. C'est l'intitulé, à gauche, qui cède la place. */}
      {value ? (
        <Small style={styles.value} numberOfLines={1}>
          {value}
        </Small>
      ) : null}
      {right ?? (onPress ? <ChevronRight size={18} color={colors.textMuted} /> : null)}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
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
    // 52 pt : au-dessus des 44 pt de cible tactile recommandés, même quand la
    // ligne tient sur un seul intitulé court.
    minHeight: 52,
  },
  texts: { flex: 1, gap: 2 },
  value: { flexShrink: 0 },
});
