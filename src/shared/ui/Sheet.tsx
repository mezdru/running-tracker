import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/shared/theme';

import { Heading } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Contenu déjà défilant (liste) : on n'ajoute pas un second défilement. */
  scroll?: boolean;
};

/** Feuille modale par le bas : choix d'allure, de modèle, de type de cible. */
export function Sheet({ visible, onClose, title, children, scroll = true }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Le fond assombri ferme la feuille : c'est le geste attendu, et il
          évite d'avoir à viser la croix en courant. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Heading numberOfLines={1} style={styles.title}>
            {title}
          </Heading>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <X size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        {scroll ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.body, styles.bodyContent]}>{children}</View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    // Plafonné : une longue liste défile à l'intérieur au lieu de couvrir
    // l'écran entier, on garde le contexte visible au-dessus.
    maxHeight: '82%',
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  // Le titre reprend le retrait du contenu et cède la place à la croix : un
  // nom de séance long poussait le bouton de fermeture hors de l'écran.
  title: { flex: 1, marginRight: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  body: { paddingHorizontal: spacing.xl },
  bodyContent: { paddingBottom: spacing.lg, gap: spacing.sm },
});
