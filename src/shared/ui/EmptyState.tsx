import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type as typography } from '@/shared/theme';

type Props = { icon?: ReactNode; title: string; hint?: string; action?: ReactNode };

export function EmptyState({ icon, title, hint, action }: Props) {
  return (
    <View style={styles.wrap}>
      {icon}
      <Text style={[typography.h2, styles.title]}>{title}</Text>
      {hint ? <Text style={[typography.body, styles.hint]}>{hint}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
  title: { textAlign: 'center' },
  hint: { color: colors.textMuted, textAlign: 'center', maxWidth: 280 },
});
