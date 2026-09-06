// Système de design de l'app. Une seule source pour les couleurs, l'échelle
// d'espacement et la typographie : les écrans n'écrivent jamais une valeur
// hexadécimale en dur, sinon l'écran de course finit par dériver du reste.
//
// Parti pris : sombre uniquement. L'écran principal est lu en courant, souvent
// en plein soleil ou de nuit, à bout de bras — on optimise le contraste et la
// taille des chiffres, pas la cohabitation avec un thème clair.
import type { TextStyle } from 'react-native';

export const colors = {
  bg: '#0A0C0F',
  surface: '#13171C',
  surfaceAlt: '#1A1F26',
  surfaceHi: '#222932',
  border: '#242B34',
  borderStrong: '#36404D',

  text: '#F5F7FA',
  textMuted: '#98A3B0',
  textFaint: '#616D7B',

  // Vert acide : c'est la couleur d'action de l'app (démarrer, valider,
  // sélection active). Volontairement unique, pour qu'un bouton important ne
  // se confonde jamais avec une pastille d'allure.
  accent: '#D6FF3F',
  accentDim: '#8FA82A',
  accentInk: '#0A0C0F',

  danger: '#FF5B5B',
  success: '#34D399',
  warning: '#FFB020',

  // Fond translucide pour les surfaces posées sur la carte.
  scrim: 'rgba(10,12,15,0.72)',
} as const;

// Palette d'intensité des allures : du bleu (récupération) au violet (sprint).
// L'ordre est un dégradé perçu, pour qu'une séance se lise d'un coup d'œil
// comme un profil d'effort et pas comme un patchwork.
export const zonePalette = [
  '#5AA9FF', // récupération
  '#34D399', // endurance fondamentale
  '#D6FF3F', // marathon / allure longue
  '#FFB020', // seuil
  '#FF7A45', // 10 km
  '#FF4D4D', // VMA
  '#C77DFF', // sprint
] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

// `fontVariant: ['tabular-nums']` sur tout ce qui est chiffré : sans lui, un
// chrono qui défile fait sautiller la mise en page à chaque changement de
// chiffre — insupportable sur l'écran de course.
//
// Typé `TextStyle` explicitement (et non `as const`) : les littéraux figés
// produiraient des tableaux en lecture seule que `StyleSheet.create` refuse.
export const type: Record<
  | 'display'
  | 'metric'
  | 'title'
  | 'h2'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'label',
  TextStyle
> = {
  display: {
    fontSize: 60,
    fontWeight: '800',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  metric: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  title: { fontSize: 27, fontWeight: '800', letterSpacing: -0.6 },
  h2: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  body: { fontSize: 15, fontWeight: '500' },
  bodyStrong: { fontSize: 15, fontWeight: '700' },
  small: { fontSize: 13, fontWeight: '500' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
};

export const theme = { colors, spacing, radius, type, zonePalette };
