import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { findZone, resolvePace, type PaceZone } from '@/entities/pace/model';
import { targetLabel } from '@/entities/workout/display';
import {
  STEP_KIND_LABEL,
  makeStep,
  type Block,
  type Step,
} from '@/entities/workout/model';
import { formatPace } from '@/shared/lib/format';
import { newId } from '@/shared/lib/id';
import { colors, radius, spacing } from '@/shared/theme';
import { Body, Card, Chip, Label, Small, Stepper } from '@/shared/ui';

type Props = {
  blocks: Block[];
  zones: PaceZone[];
  vmaKmh: number;
  onChange: (blocks: Block[]) => void;
  onEditStep: (blockId: string, step: Step) => void;
};

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

/** Petit bouton d'icône des barres d'action de bloc et d'étape. */
function IconButton({
  icon,
  onPress,
  label,
  disabled,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, { opacity: disabled ? 0.25 : pressed ? 0.5 : 1 }]}
    >
      {icon}
    </Pressable>
  );
}

/** Liste éditable des blocs d'une séance. */
export function BlockList({ blocks, zones, vmaKmh, onChange, onEditStep }: Props) {
  const replaceBlock = (blockId: string, next: Block) =>
    onChange(blocks.map((block) => (block.id === blockId ? next : block)));

  const renderStep = (
    block: Block,
    step: Step,
    index: number,
    total: number,
    onSteps: (steps: Step[]) => void,
    steps: Step[],
  ) => {
    const zone = findZone(zones, step.zoneId);
    const pace = zone ? resolvePace(zone, vmaKmh) : 0;
    return (
      <Pressable
        key={step.id}
        onPress={() => onEditStep(block.id, step)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.stepRow, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View style={[styles.zoneBar, { backgroundColor: zone?.color ?? colors.borderStrong }]} />
        <View style={styles.stepTexts}>
          <Body style={styles.stepTitle}>
            {STEP_KIND_LABEL[step.kind]} · {targetLabel(step.target)}
          </Body>
          <Small>
            {zone ? `${zone.short} · ${formatPace(pace)} /km` : 'Allure supprimée — à choisir'}
          </Small>
        </View>
        {total > 1 ? (
          <View style={styles.stepActions}>
            <IconButton
              label="Monter l’étape"
              disabled={index === 0}
              icon={<ArrowUp size={15} color={colors.textFaint} />}
              onPress={() => onSteps(move(steps, index, -1))}
            />
            <IconButton
              label="Descendre l’étape"
              disabled={index === total - 1}
              icon={<ArrowDown size={15} color={colors.textFaint} />}
              onPress={() => onSteps(move(steps, index, 1))}
            />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      {blocks.map((block, blockIndex) => {
        const actions = (
          <View style={styles.blockActions}>
            <IconButton
              label="Monter le bloc"
              disabled={blockIndex === 0}
              icon={<ArrowUp size={16} color={colors.textFaint} />}
              onPress={() => onChange(move(blocks, blockIndex, -1))}
            />
            <IconButton
              label="Descendre le bloc"
              disabled={blockIndex === blocks.length - 1}
              icon={<ArrowDown size={16} color={colors.textFaint} />}
              onPress={() => onChange(move(blocks, blockIndex, 1))}
            />
            <IconButton
              label="Dupliquer le bloc"
              icon={<Copy size={16} color={colors.textFaint} />}
              onPress={() => {
                // Identifiants régénérés, sinon les deux copies seraient
                // éditées ensemble.
                const copy: Block =
                  block.type === 'single'
                    ? { id: newId('bl'), type: 'single', step: { ...block.step, id: newId('st') } }
                    : {
                        id: newId('bl'),
                        type: 'repeat',
                        count: block.count,
                        steps: block.steps.map((step) => ({ ...step, id: newId('st') })),
                      };
                const next = [...blocks];
                next.splice(blockIndex + 1, 0, copy);
                onChange(next);
              }}
            />
            <IconButton
              label="Supprimer le bloc"
              icon={<Trash2 size={16} color={colors.danger} />}
              onPress={() => onChange(blocks.filter((b) => b.id !== block.id))}
            />
          </View>
        );

        if (block.type === 'single') {
          return (
            <Card key={block.id} style={styles.block} padded={false}>
              {renderStep(
                block,
                block.step,
                0,
                1,
                () => undefined,
                [block.step],
              )}
              <View style={styles.blockFooter}>{actions}</View>
            </Card>
          );
        }

        return (
          <Card key={block.id} style={styles.block} padded={false}>
            <View style={styles.repeatHeader}>
              <Chip label="Série" color={colors.accent} compact />
              <View style={styles.repeatStepper}>
                <Stepper
                  value={block.count}
                  onChange={(count) => replaceBlock(block.id, { ...block, count })}
                  step={1}
                  min={1}
                  max={50}
                  format={(count) => `× ${count}`}
                />
              </View>
            </View>

            <View style={styles.repeatSteps}>
              {block.steps.map((step, index) =>
                renderStep(
                  block,
                  step,
                  index,
                  block.steps.length,
                  (steps) => replaceBlock(block.id, { ...block, steps }),
                  block.steps,
                ),
              )}
            </View>

            <View style={styles.blockFooter}>
              <Pressable
                onPress={() =>
                  replaceBlock(block.id, {
                    ...block,
                    steps: [
                      ...block.steps,
                      makeStep({
                        kind: 'recovery',
                        zoneId: zones[0]?.id ?? '',
                        target: { type: 'time', seconds: 60 },
                      }),
                    ],
                  })
                }
                accessibilityRole="button"
                style={styles.addStep}
              >
                <Plus size={14} color={colors.textMuted} />
                <Label color={colors.textMuted}>Étape</Label>
              </Pressable>
              {actions}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  block: { overflow: 'hidden' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
  },
  zoneBar: { width: 4, alignSelf: 'stretch', borderRadius: radius.pill, marginLeft: spacing.md },
  stepTexts: { flex: 1, gap: 2 },
  stepTitle: { fontWeight: '600' },
  stepActions: { flexDirection: 'row', gap: spacing.xs },
  repeatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  repeatStepper: { flex: 1, maxWidth: 170 },
  repeatSteps: {
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  blockFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  blockActions: { flexDirection: 'row', gap: spacing.md, marginLeft: 'auto' },
  iconButton: { padding: 4 },
  addStep: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: 4 },
});
