import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/shared/theme';

import { Body, Heading } from './Text';

type Props = { icon?: ReactNode; title: string; hint?: string; action?: ReactNode };

export function EmptyState({ icon, title, hint, action }: Props) {
  return (
    <View style={styles.wrap}>
      {icon}
      <Heading style={styles.title}>{title}</Heading>
      {hint ? <Body color={colors.textMuted} style={styles.hint}>
          {hint}
        </Body> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
  title: { textAlign: 'center' },
  hint: { textAlign: 'center', maxWidth: 280 },
});
