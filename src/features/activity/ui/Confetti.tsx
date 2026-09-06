import { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors, zonePalette } from '@/shared/theme';

/**
 * Pluie de confettis jouée une fois, à l'arrivée sur le bilan de séance.
 *
 * Tout est animé par des TRANSFORMS et de l'opacité, avec `useNativeDriver` :
 * l'animation part alors sur le thread d'interface et reste fluide pendant que
 * le fil JavaScript relit l'activité en base et calcule les récompenses — ce
 * qui arrive exactement au même moment.
 */

const PIECE_COUNT = 44;
const PALETTE = [...zonePalette, colors.accent, '#FFFFFF'];

type Piece = {
  key: number;
  /** Position horizontale de départ, en fraction de la largeur. */
  x: number;
  /** Amplitude de la dérive latérale, en points. */
  drift: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  spin: number;
  /** Rectangle allongé ou petit carré : deux formes valent mieux qu'une. */
  ratio: number;
  progress: Animated.Value;
};

/**
 * Générateur pseudo-aléatoire semé (xorshift32).
 *
 * Le tirage est DÉTERMINISTE, dérivé de l'identifiant de la séance : chaque
 * sortie a ses confettis, toujours les mêmes pour elle. C'est ce qui permet de
 * les calculer pendant le rendu — `Math.random` y serait impur — sans figer la
 * même pluie pour toutes les séances.
 */
function seeded(seed: string) {
  let x = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    x ^= seed.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0xffffffff;
  };
}

function makePieces(seed: string): Piece[] {
  const random = seeded(seed);
  return Array.from({ length: PIECE_COUNT }, (_, key) => ({
    key,
    x: random(),
    drift: (random() - 0.5) * 140,
    delay: random() * 450,
    duration: 2200 + random() * 1600,
    size: 7 + random() * 7,
    color: PALETTE[Math.floor(random() * PALETTE.length)],
    spin: 360 + random() * 900,
    ratio: random() > 0.5 ? 1 : 2.2,
    progress: new Animated.Value(0),
  }));
}

export function Confetti({ seed }: { seed: string }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(() => makePieces(seed), [seed]);

  useEffect(() => {
    const group = Animated.parallel(
      pieces.map((piece) =>
        Animated.timing(piece.progress, {
          toValue: 1,
          duration: piece.duration,
          delay: piece.delay,
          // Légère accélération : une chute à vitesse constante ne ressemble à
          // rien, la gravité manque.
          easing: Easing.bezier(0.25, 0.4, 0.6, 1),
          useNativeDriver: true,
        }),
      ),
    );
    group.start();
    return () => group.stop();
  }, [pieces]);

  return (
    // `pointerEvents: none` : la couche couvre tout l'écran, elle ne doit
    // intercepter aucun appui sur le contenu qu'elle survole.
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece) => (
        <Animated.View
          key={piece.key}
          style={[
            styles.piece,
            {
              left: piece.x * width,
              width: piece.size,
              height: piece.size * piece.ratio,
              backgroundColor: piece.color,
              opacity: piece.progress.interpolate({
                inputRange: [0, 0.1, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateY: piece.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-60, height + 60],
                  }),
                },
                {
                  translateX: piece.progress.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, piece.drift, piece.drift * 0.3],
                  }),
                },
                {
                  rotate: piece.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${piece.spin}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, borderRadius: 2 },
});
