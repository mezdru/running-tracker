// Texte typé par rôle plutôt que par taille. Un écran écrit `<Title>` ou
// `<Label>`, jamais `fontSize: 19` : la hiérarchie reste cohérente et une
// retouche typographique se fait en un seul endroit.
import type { ReactNode } from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';

import { colors, type as typography } from '@/shared/theme';

type Props = TextProps & {
  children: ReactNode;
  color?: string;
  style?: TextStyle | TextStyle[];
};

function make(base: TextStyle, defaultColor: string) {
  return function Typed({ children, color, style, ...rest }: Props) {
    return (
      <RNText {...rest} style={[base, { color: color ?? defaultColor }, style]}>
        {children}
      </RNText>
    );
  };
}

export const Display = make(typography.display, colors.text);
export const Metric = make(typography.metric, colors.text);
export const Title = make(typography.title, colors.text);
export const Heading = make(typography.h2, colors.text);
export const Body = make(typography.body, colors.text);
export const BodyStrong = make(typography.bodyStrong, colors.text);
export const Small = make(typography.small, colors.textMuted);
export const Label = make(
  StyleSheet.flatten([typography.label, { textTransform: 'uppercase' as const }]),
  colors.textFaint,
);
