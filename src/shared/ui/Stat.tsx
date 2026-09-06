import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type as typography } from '@/shared/theme';

type Props = {
  value: string;
  label: string;
  unit?: string;
  color?: string;
  /** `lg` pour les cadrans de course, `md` par défaut. */
  size?: 'md' | 'lg';
  align?: 'left' | 'center';
};

/**
 * Nombre de signes qu'une colonne accueille à pleine taille. Un bandeau tient
 * toujours trois colonnes sur la largeur de l'écran, soit une centaine de
 * points chacune : « 440 » y entre, « 36 h 21 » non.
 */
const BUDGET: Record<'md' | 'lg', number> = { md: 6, lg: 5 };

/**
 * Hauteur de ligne du chiffre, FIXE quelle que soit la taille retenue.
 *
 * Sans elle, une valeur réduite occupe une boîte plus basse : son intitulé
 * remonte, et la rangée d'intitulés d'un bandeau devient irrégulière alors que
 * c'est précisément la ligne qu'on parcourt du regard.
 */
const LINE_HEIGHT: Record<'md' | 'lg', number> = { md: 38, lg: 70 };

/**
 * Taille du chiffre, réduite quand la valeur est trop longue pour sa colonne.
 *
 * `adjustsFontSizeToFit` ferait ce travail nativement, mais la propriété est
 * sans effet sur la nouvelle architecture de React Native : le texte déborde
 * sur la colonne voisine au lieu de rétrécir — « 36 h 21 » venait se coller au
 * nombre de sorties. Les chiffres sont tabulaires, donc la largeur est
 * proportionnelle au nombre de signes : une règle sur la longueur suffit, et
 * elle se vérifie au sol plutôt qu'à l'œil sur un simulateur.
 */
export function fitFontSize(base: number, length: number, budget: number): number {
  if (!Number.isFinite(length) || length <= 0) return base;
  if (length <= budget) return base;
  // Plancher à 62 % : en deçà, le chiffre cesse d'être un chiffre de bandeau et
  // mieux vaut alors raccourcir la valeur à la source.
  return Math.max(Math.round(base * 0.62), Math.round((base * budget) / length));
}

/** Un chiffre et son intitulé : la brique de tous les résumés de l'app. */
export function Stat({ value, label, unit, color, size = 'md', align = 'left' }: Props) {
  const centered = align === 'center';
  const base = size === 'lg' ? typography.display : typography.metric;
  // L'unité occupe la même colonne que le chiffre : elle doit peser dans le
  // calcul, sinon « 440,0 km » remplit sa colonne et vient toucher le total
  // suivant. Composée en 13 px face à 32, et précédée d'une espace, elle vaut
  // un peu moins d'un demi-signe par lettre.
  const weight = value.length + (unit ? unit.length * 0.45 + 0.4 : 0);
  const fontSize = fitFontSize(base.fontSize ?? 32, weight, BUDGET[size]);

  return (
    <View style={[styles.wrap, !centered && styles.gutter]}>
      {/* La rangée occupe toute la colonne. Réduite à son contenu — ce que
          faisait `alignItems: 'flex-start'` sur le parent —, elle n'imposait
          aucune limite au chiffre. */}
      <View style={[styles.row, centered && styles.rowCentered]}>
        <Text
          style={[
            base,
            { fontSize, lineHeight: LINE_HEIGHT[size], color: color ?? colors.text },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {unit ? <Text style={[typography.small, styles.unit]}>{unit}</Text> : null}
      </View>
      {/* Sur une seule ligne : un intitulé qui passe à deux lignes décale la
          ligne de base de sa colonne et casse l'alignement du bandeau. */}
      <Text
        style={[typography.label, styles.label, centered && styles.labelCentered]}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Toujours employé par rangées de trois. `flex: 1` donne des colonnes de
  // largeur égale : avec `space-between`, la largeur de chaque colonne suivait
  // celle de son chiffre et la dernière venait buter contre le bord.
  // La gouttière est portée par la colonne elle-même plutôt que par un `gap`
  // sur chacun des sept bandeaux de l'app : sans elle, l'unité d'une colonne
  // touche le chiffre de la suivante. Le retrait de la dernière colonne tombe
  // dans la marge de la carte, il ne se voit pas.
  wrap: { flex: 1 },
  gutter: { paddingRight: spacing.sm },
  // `baseline` et non `flex-end` : aligner les BOÎTES posait l'unité trop haut,
  // parce qu'un chiffre de 32 px réserve plus de place sous sa ligne de base
  // qu'un texte de 13 px. Yoga sait aligner les lignes de base elles-mêmes, ce
  // qui rend le calage exact sans constante à retoucher à chaque taille.
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  rowCentered: { justifyContent: 'center' },
  unit: { color: colors.textMuted },
  label: { color: colors.textFaint, marginTop: 2 },
  labelCentered: { textAlign: 'center' },
});
