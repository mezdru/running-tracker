import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme';
import { Display, Label, Small } from '@/shared/ui';

type Props = { title: string; subtitle: string };

/**
 * En-tête de fin de séance : médaille qui surgit, onde qui se propage,
 * vibration de succès. Trois secondes, une seule fois, à l'arrivée — c'est le
 * moment où l'app doit dire quelque chose, et le seul.
 */
export function Celebration({ title, subtitle }: Props) {
  // `useState` avec initialiseur paresseux plutôt que `useRef` : la valeur est
  // créée une fois et reste stable, mais elle n'est pas lue comme une
  // référence pendant le rendu — ce que le compilateur React interdit, à juste
  // titre, puisque cela empêcherait toute mémoïsation du composant.
  const [pop] = useState(() => new Animated.Value(0));
  const [wave] = useState(() => new Animated.Value(0));
  const [text] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Vibration en deux temps : une impulsion sèche à l'apparition de la
    // médaille, la notification de succès quand elle est en place. Sur un
    // téléphone tenu en main après l'effort, c'est ce qui se sent le plus.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const successTimer = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 260);

    const animation = Animated.parallel([
      // Ressort volontairement peu amorti : la médaille dépasse sa taille puis
      // revient, ce qui donne l'impression qu'elle « arrive » au lieu
      // d'apparaître.
      Animated.spring(pop, { toValue: 1, friction: 4.5, tension: 90, useNativeDriver: true }),
      Animated.timing(text, {
        toValue: 1,
        duration: 420,
        delay: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(wave, {
          toValue: 1,
          duration: 1900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        { iterations: 3 },
      ),
    ]);
    animation.start();

    return () => {
      clearTimeout(successTimer);
      animation.stop();
    };
  }, [pop, wave, text]);

  const rise = {
    opacity: text,
    transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.medalArea}>
        {/* Onde concentrique : elle part de la médaille et se dissout. */}
        <Animated.View
          style={[
            styles.wave,
            {
              opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
              transform: [
                { scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.9, 2.1] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.medal,
            {
              opacity: pop,
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              ],
            },
          ]}
        >
          <Check size={44} color={colors.accentInk} strokeWidth={3.5} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.texts, rise]}>
        <Label color={colors.accent}>Séance terminée</Label>
        <Display style={styles.title} numberOfLines={2}>
          {title}
        </Display>
        <Small style={styles.subtitle}>{subtitle}</Small>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xl },
  medalArea: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  wave: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  medal: {
    width: 92,
    height: 92,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 34, letterSpacing: -1, textAlign: 'center' },
  subtitle: { textAlign: 'center' },
});
