// Enveloppe d'écran : fond, zones sûres et espacement horizontal communs. Tous
// les écrans passent par là, pour qu'aucun ne redéfinisse ses marges dans son
// coin — c'est ce qui fait qu'une app « bouge » d'un écran à l'autre.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/shared/theme';

type Props = {
  children: ReactNode;
  /** Rend le contenu défilant ; `false` pour les écrans à liste ou à carte. */
  scroll?: boolean;
  /** Retire le retrait horizontal, pour un contenu bord à bord. */
  flush?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  /**
   * Contenu posé PAR-DESSUS l'écran, hors du défilement : confettis, voile,
   * indicateur flottant. Placé ici et non dans `children` parce qu'un calque
   * absolu à l'intérieur d'un ScrollView se positionne par rapport au
   * contenu — donc défile avec lui et déborde de l'écran.
   */
  overlay?: ReactNode;
};

export function Screen({
  children,
  scroll = false,
  flush = false,
  edges = ['top'],
  contentStyle,
  overlay,
}: Props) {
  const padding = flush ? undefined : styles.padded;
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[padding, styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, padding, contentStyle]}>{children}</View>
      )}
      {overlay}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg },
  // Marge basse généreuse : la barre d'onglets flotte au-dessus du contenu.
  scrollContent: { paddingBottom: spacing.xxxl * 3 },
});
