import { ScrollView, StyleSheet, View } from 'react-native';

import type { StepTarget } from '@/entities/workout/model';
import { formatDistance, formatDurationShort } from '@/shared/lib/format';
import { spacing } from '@/shared/theme';
import { Chip, Segmented, Stepper } from '@/shared/ui';

type Props = { value: StepTarget; onChange: (target: StepTarget) => void };

// Valeurs courantes d'un plan de course à pied. Les proposer d'un appui évite
// une dizaine de pressions sur l'incrémenteur pour la fraction la plus banale
// qui soit ; l'incrémenteur reste là pour tout le reste.
const DISTANCE_PRESETS = [200, 400, 600, 800, 1000, 1600, 2000, 5000];
const TIME_PRESETS = [30, 60, 90, 120, 300, 600, 1200, 2700];

/** Choix de la cible d'une étape : une distance ou une durée. */
export function TargetEditor({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Segmented
        value={value.type}
        onChange={(type) =>
          onChange(
            type === 'distance'
              ? // La conversion garde un ordre de grandeur plausible : basculer
                // d'une durée à une distance ne doit pas repartir de zéro.
                { type: 'distance', meters: 400 }
              : { type: 'time', seconds: 60 },
          )
        }
        options={[
          { value: 'distance', label: 'Distance' },
          { value: 'time', label: 'Durée' },
        ]}
      />

      {value.type === 'distance' ? (
        <Stepper
          value={value.meters}
          onChange={(meters) => onChange({ type: 'distance', meters })}
          // Pas de 50 m : c'est la plus petite variation qui ait du sens sur
          // une piste, et elle divise toutes les distances usuelles.
          step={50}
          min={50}
          max={60000}
          format={(meters) => formatDistance(meters)}
        />
      ) : (
        <Stepper
          value={value.seconds}
          onChange={(seconds) => onChange({ type: 'time', seconds })}
          step={15}
          min={15}
          max={4 * 3600}
          format={(seconds) => formatDurationShort(seconds)}
        />
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
        {value.type === 'distance'
          ? DISTANCE_PRESETS.map((meters) => (
              <Chip
                key={meters}
                label={formatDistance(meters)}
                active={value.meters === meters}
                onPress={() => onChange({ type: 'distance', meters })}
              />
            ))
          : TIME_PRESETS.map((seconds) => (
              <Chip
                key={seconds}
                label={formatDurationShort(seconds)}
                active={value.seconds === seconds}
                onPress={() => onChange({ type: 'time', seconds })}
              />
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  presets: { gap: spacing.sm, paddingVertical: spacing.xs },
});
