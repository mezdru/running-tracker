import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type as typography } from '@/shared/theme';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Dernier filet avant l'écran blanc. Il compte particulièrement ici : une
 * exception de rendu PENDANT une séance ferait perdre la trace en cours, alors
 * qu'un écran de secours laisse au moins la possibilité de revenir en arrière
 * et de terminer proprement.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.wrap}>
        <Text style={[typography.h2, styles.title]}>Quelque chose a cassé</Text>
        <Text style={[typography.body, styles.detail]}>{error.message}</Text>
        <Pressable style={styles.button} onPress={() => this.setState({ error: null })}>
          <Text style={[typography.bodyStrong, { color: colors.accentInk }]}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: { color: colors.text, textAlign: 'center' },
  detail: { color: colors.textMuted, textAlign: 'center' },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xxl,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
