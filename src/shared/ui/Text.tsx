// Texte typé par rôle plutôt que par taille. Un écran écrit `<Title>` ou
// `<Label>`, jamais `fontSize: 19` : la hiérarchie reste cohérente et une
// retouche typographique se fait en un seul endroit.
import type { ReactNode } from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';

import { type as typography } from '@/shared/theme';

type Props = TextProps & {
  children: ReactNode;
  color?: string;
  style?: TextStyle | TextStyle[];
};

// La couleur vient du jeton lui-même : la dupliquer ici ferait deux sources de
// vérité, et c'est exactement le genre d'écart qui finit par produire du texte
// invisible sur un écran qu'on ne regarde qu'une fois par mois.
function make(base: TextStyle) {
  return function Typed({ children, color, style, ...rest }: Props) {
    return (
      <RNText {...rest} style={[base, color ? { color } : null, style]}>
        {children}
      </RNText>
    );
  };
}

export const Display = make(typography.display);
export const Metric = make(typography.metric);
export const Title = make(typography.title);
export const Heading = make(typography.h2);
export const Body = make(typography.body);
export const BodyStrong = make(typography.bodyStrong);
export const Small = make(typography.small);
export const Label = make(
  StyleSheet.flatten([typography.label, { textTransform: 'uppercase' as const }]),
);
