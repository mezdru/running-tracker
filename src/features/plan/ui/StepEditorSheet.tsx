import { StyleSheet, View } from 'react-native';

import { resolvePace, type PaceZone } from '@/entities/pace/model';
import { STEP_KIND_LABEL, type Step, type StepKind } from '@/entities/workout/model';
import { formatPace } from '@/shared/lib/format';
import { spacing } from '@/shared/theme';
import { Button, Chip, Label, Sheet } from '@/shared/ui';

import { TargetEditor } from './TargetEditor';

type Props = {
  step: Step | null;
  zones: PaceZone[];
  vmaKmh: number;
  onChange: (step: Step) => void;
  onDelete: () => void;
  onClose: () => void;
};

const KINDS: StepKind[] = ['warmup', 'interval', 'recovery', 'run', 'cooldown'];

/**
 * Édition d'une étape. En feuille modale et non sur un écran dédié : construire
 * une séance, c'est ajuster dix étapes de suite, et un aller-retour d'écran à
 * chaque fois rendrait l'opération pénible. Les modifications sont appliquées
 * à la volée, il n'y a rien à valider.
 */
export function StepEditorSheet({ step, zones, vmaKmh, onChange, onDelete, onClose }: Props) {
  return (
    <Sheet visible={step !== null} onClose={onClose} title="Étape">
      {step ? (
        <View style={styles.wrap}>
          <View style={styles.group}>
            <Label>Type</Label>
            <View style={styles.chips}>
              {KINDS.map((kind) => (
                <Chip
                  key={kind}
                  label={STEP_KIND_LABEL[kind]}
                  active={step.kind === kind}
                  onPress={() => onChange({ ...step, kind })}
                />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Label>Cible</Label>
            <TargetEditor
              value={step.target}
              onChange={(target) => onChange({ ...step, target })}
            />
          </View>

          <View style={styles.group}>
            <Label>Allure</Label>
            <View style={styles.chips}>
              {zones.map((zone) => (
                <Chip
                  key={zone.id}
                  label={`${zone.short} ${formatPace(resolvePace(zone, vmaKmh))}`}
                  color={zone.color}
                  active={step.zoneId === zone.id}
                  onPress={() => onChange({ ...step, zoneId: zone.id })}
                />
              ))}
            </View>
          </View>

          <Button label="Supprimer l’étape" variant="danger" full onPress={onDelete} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl, paddingBottom: spacing.md },
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
