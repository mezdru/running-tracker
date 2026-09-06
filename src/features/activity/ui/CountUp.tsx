import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

type Props = {
  /** Valeur finale. */
  value: number;
  /** Mise en forme du nombre à chaque image. */
  format: (value: number) => string;
  duration?: number;
  delay?: number;
  children: (text: string) => React.ReactElement;
};

/**
 * Compteur qui monte jusqu'à sa valeur. Un chiffre qui défile se regarde ; le
 * même chiffre posé d'un coup se lit et s'oublie — c'est toute la différence
 * entre un bilan et une récompense.
 *
 * `useNativeDriver: false` est ici obligatoire : la valeur animée n'alimente
 * pas un style mais un TEXTE, ce que seul le fil JavaScript sait faire. Le
 * coût est borné — trois compteurs, moins d'une seconde, sur un écran statique.
 */
export function CountUp({ value, format, duration = 900, delay = 120, children }: Props) {
  const [animated] = useState(() => new Animated.Value(0));
  const [display, setDisplay] = useState(() => format(0));

  useEffect(() => {
    const subscription = animated.addListener(({ value: progress }) => {
      setDisplay(format(progress * value));
    });
    const animation = Animated.timing(animated, {
      toValue: 1,
      duration,
      delay,
      // Décélération franche : l'essentiel du défilement se joue au début, et
      // le nombre se stabilise sans traîner.
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      animated.removeListener(subscription);
    };
    // `format` est une fonction recréée à chaque rendu du parent : la mettre en
    // dépendance relancerait l'animation en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, delay]);

  return children(display);
}
