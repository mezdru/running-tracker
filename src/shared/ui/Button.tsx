import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radius, spacing, type as typography } from '@/shared/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: ViewStyle;
};

const BACKGROUND: Record<Variant, string> = {
  primary: colors.accent,
  secondary: colors.surfaceHi,
  ghost: 'transparent',
  danger: 'transparent',
};

const FOREGROUND: Record<Variant, string> = {
  primary: colors.accentInk,
  secondary: colors.text,
  ghost: colors.textMuted,
  danger: colors.danger,
};

const HEIGHT: Record<Size, number> = { sm: 34, md: 46, lg: 56 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  full,
  style,
}: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive }}
      // Le retour visuel au doigt remplace toute animation : sur l'écran de
      // course, l'important est de savoir qu'un appui a été pris en compte.
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          backgroundColor: BACKGROUND[variant],
          borderColor: variant === 'danger' ? colors.danger : 'transparent',
          borderWidth: variant === 'danger' ? 1 : 0,
          opacity: inactive ? 0.4 : pressed ? 0.72 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={FOREGROUND[variant]} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            style={[
              size === 'sm' ? typography.small : typography.bodyStrong,
              { color: FOREGROUND[variant], fontWeight: '700' },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
