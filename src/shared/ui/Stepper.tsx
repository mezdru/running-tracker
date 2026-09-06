import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type as typography } from '@/shared/theme';

type Props = {
  value: number;
  onChange: (value: number) => void;
  step: number;
  min?: number;
  max?: number;
  /** Rendu de la valeur (durée, distance, nombre de répétitions…). */
  format: (value: number) => string;
  label?: string;
};

/**
 * Incrémenteur à deux boutons. Choisi plutôt qu'un champ de saisie : régler
 * « 8 répétitions » ou « 400 m » se fait en deux appuis, sans ouvrir le clavier
 * — et ces valeurs sont toujours des multiples ronds.
 */
export function Stepper({ value, onChange, step, min = 0, max = Infinity, format, label }: Props) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <View>
      {label ? <Text style={[typography.label, styles.label]}>{label.toUpperCase()}</Text> : null}
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(clamp(value - step))}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Diminuer ${label ?? ''}`.trim()}
          style={({ pressed }) => [
            styles.button,
            { opacity: value <= min ? 0.3 : pressed ? 0.6 : 1 },
          ]}
        >
          <Minus size={18} color={colors.text} />
        </Pressable>
        <Text style={[typography.bodyStrong, styles.value]}>{format(value)}</Text>
        <Pressable
          onPress={() => onChange(clamp(value + step))}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Augmenter ${label ?? ''}`.trim()}
          style={({ pressed }) => [
            styles.button,
            { opacity: value >= max ? 0.3 : pressed ? 0.6 : 1 },
          ]}
        >
          <Plus size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textFaint, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
  },
  button: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});
