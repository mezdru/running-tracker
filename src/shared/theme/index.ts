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
  // Filet décoratif : il souligne un bord que le fond distingue déjà.
  border: '#242B34',
  // Bord PORTEUR de sens — contour d'une zone tappable, jauge de graphique,
  // poignée de feuille. Tenu à 3:1 sur le fond, le seuil AA des éléments non
  // textuels.
  borderStrong: '#5A6879',

  text: '#F5F7FA',
  textMuted: '#98A3B0',
  // Troisième niveau de gris. Il porte les intitulés en 12 px (`type.label`),
  // donc il doit tenir 4,5:1 — le seuil AA du texte normal — y compris sur
  // `surfaceHi`, la surface la plus claire de l'app : #616D7B n'y était qu'à
  // 2,8:1. La hiérarchie avec `textMuted` se joue désormais surtout sur la
  // taille et la graisse, ce qui est de toute façon plus robuste que 15 % de
  // luminance en plein soleil.
  textFaint: '#8592A3',

  // Vert acide : c'est la couleur d'action de l'app (démarrer, valider,
  // sélection active). Volontairement unique, pour qu'un bouton important ne
  // se confonde jamais avec une pastille d'allure.
  accent: '#D6FF3F',
  accentDim: '#8FA82A',
  accentInk: '#0A0C0F',

  danger: '#FF5B5B',
  // Bleu d'information : partir TROP VITE sur un fractionné est une erreur
  // aussi, mais ce n'est pas la même que traîner — elle ne mérite pas l'ambre.
  info: '#5AA9FF',
  // Violet des jalons franchis, distinct du vert d'action pour qu'un record
  // personnel ne se lise pas comme un bouton.
  celebration: '#C77DFF',
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

// Chaque jeton porte sa couleur d'encre. Sans elle, un `<Text>` qui n'applique
// que la taille retombe sur le noir de React Native — invisible sur un fond
// sombre, et invisible aussi à la relecture, puisqu'il ne manque rien à l'œil
// dans le code. Le bug s'était glissé quatre fois, dont l'écran de secours.
//
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
    color: colors.text,
    fontSize: 60,
    fontWeight: '800',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  metric: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  title: { color: colors.text, fontSize: 27, fontWeight: '800', letterSpacing: -0.6 },
  h2: { color: colors.text, fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  body: { color: colors.text, fontSize: 15, fontWeight: '500' },
  bodyStrong: { color: colors.text, fontSize: 15, fontWeight: '700' },
  small: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  // 12 px et non 11 : ces intitulés se lisent à bout de bras, en courant.
  label: { color: colors.textFaint, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
};

export const theme = { colors, spacing, radius, type, zonePalette };
