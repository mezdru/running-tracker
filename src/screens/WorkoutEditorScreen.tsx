import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LayoutTemplate, Plus, Repeat } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { ZONE_IDS, paceTable, preferredZoneId } from '@/entities/pace/model';
import { estimateBlocks } from '@/entities/workout/estimate';
import {
  WORKOUT_KINDS,
  WORKOUT_KIND_LABEL,
  cloneBlocks,
  makeStep,
  repeatBlock,
  singleBlock,
  type Block,
  type Step,
  type WorkoutKind,
} from '@/entities/workout/model';
import { KIND_COLOR } from '@/entities/workout/display';
import { builtinTemplates, listUserTemplates, type Template } from '@/entities/workout/templates';
import { usePlanStore } from '@/features/plan/store';
import { BlockList } from '@/features/plan/ui/BlockList';
import { StepEditorSheet } from '@/features/plan/ui/StepEditorSheet';
import { fromKey, labelDayFull, shiftKey, toKey, todayKey, weekStart } from '@/shared/lib/date';
import { formatDurationShort, formatKm } from '@/shared/lib/format';
import { colors, radius, spacing, type as typography } from '@/shared/theme';
import { Button, Card, Chip, Label, Row, Screen, Sheet, Small, Stat } from '@/shared/ui';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorkoutEditor'>;
type EditorRoute = RouteProp<RootStackParamList, 'WorkoutEditor'>;

const KIND_DEFAULT_NAME: Record<WorkoutKind, string> = {
  easy: 'Footing',
  long: 'Sortie longue',
  intervals: 'Fractionné',
  tempo: 'Séance au seuil',
  race: 'Course',
  recovery: 'Récupération',
  other: 'Séance',
};

export function WorkoutEditorScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<EditorRoute>();
  const settings = usePlanStore((state) => state.settings);
  const workouts = usePlanStore((state) => state.workouts);
  const createWorkout = usePlanStore((state) => state.createWorkout);
  const updateWorkout = usePlanStore((state) => state.updateWorkout);
  const removeWorkout = usePlanStore((state) => state.removeWorkout);

  const existing = params?.workoutId
    ? workouts.find((workout) => workout.id === params.workoutId)
    : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<WorkoutKind>(existing?.kind ?? 'easy');
  const [date, setDate] = useState(existing?.date ?? params?.date ?? todayKey());
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [blocks, setBlocks] = useState<Block[]>(
    existing
      ? existing.blocks
      : [
          singleBlock(
            makeStep({
              kind: 'run',
              zoneId: preferredZoneId(settings.zones, ZONE_IDS.easy),
              target: { type: 'time', seconds: 45 * 60 },
            }),
          ),
        ],
  );

  const [editing, setEditing] = useState<{ blockId: string; step: Step } | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const estimate = useMemo(
    () => estimateBlocks(blocks, paceTable(settings.zones, settings.vmaKmh)),
    [blocks, settings],
  );

  const templates = useMemo<Template[]>(
    () => [...listUserTemplates(), ...builtinTemplates()],
    [],
  );

  const applyStep = (next: Step) => {
    if (!editing) return;
    setEditing({ ...editing, step: next });
    setBlocks((current) =>
      current.map((block) => {
        if (block.id !== editing.blockId) return block;
        if (block.type === 'single') return { ...block, step: next };
        return {
          ...block,
          steps: block.steps.map((step) => (step.id === next.id ? next : step)),
        };
      }),
    );
  };

  const deleteStep = () => {
    if (!editing) return;
    const { blockId, step } = editing;
    setEditing(null);
    setBlocks((current) =>
      current.flatMap((block) => {
        if (block.id !== blockId) return [block];
        // Un bloc simple disparaît avec son étape ; dans une série, on retire
        // l'étape et on ne garde la série que si elle contient encore quelque
        // chose.
        if (block.type === 'single') return [];
        const steps = block.steps.filter((candidate) => candidate.id !== step.id);
        return steps.length > 0 ? [{ ...block, steps }] : [];
      }),
    );
  };

  const handleSave = () => {
    const finalName = name.trim() || KIND_DEFAULT_NAME[kind];
    if (existing) {
      updateWorkout(existing.id, { name: finalName, kind, date, notes, blocks });
    } else {
      createWorkout({ date, name: finalName, kind, blocks, notes });
    }
    navigation.goBack();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert('Supprimer la séance', `« ${existing.name} » sera définitivement supprimée.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          removeWorkout(existing.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const defaultZone = preferredZoneId(settings.zones, ZONE_IDS.easy);

  // Trois mois de dates proposées : au-delà, on prépare rarement une séance
  // isolée — on duplique une semaine.
  const dateOptions = useMemo(() => {
    const start = weekStart(fromKey(todayKey()));
    const first = toKey(start);
    return Array.from({ length: 98 }, (_, i) => shiftKey(first, i));
  }, []);

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.header}>
        <Button label="Annuler" variant="ghost" size="sm" onPress={() => navigation.goBack()} />
        <Button label="Enregistrer" size="sm" onPress={handleSave} />
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={KIND_DEFAULT_NAME[kind]}
        placeholderTextColor={colors.textFaint}
        style={styles.nameInput}
        accessibilityLabel="Nom de la séance"
        returnKeyType="done"
      />

      <View style={styles.kinds}>
        {WORKOUT_KINDS.map((option) => (
          <Chip
            key={option}
            label={WORKOUT_KIND_LABEL[option]}
            color={KIND_COLOR[option]}
            active={kind === option}
            onPress={() => setKind(option)}
          />
        ))}
      </View>

      <Card style={styles.summary}>
        <Stat value={formatKm(estimate.distanceM)} unit="km" label="Distance" />
        <Stat value={formatDurationShort(estimate.durationS)} label="Durée" />
        <Stat
          value={String(blocks.length)}
          label={blocks.length > 1 ? 'Blocs' : 'Bloc'}
        />
      </Card>

      <Card padded={false} style={styles.rows}>
        <View style={styles.rowInner}>
          <Row
            label="Date"
            value={labelDayFull(fromKey(date))}
            onPress={() => setDateOpen(true)}
          />
        </View>
      </Card>

      <View style={styles.sectionHeader}>
        <Label>Structure</Label>
        <Pressable
          onPress={() => setTemplatesOpen(true)}
          accessibilityRole="button"
          style={styles.templateLink}
        >
          <LayoutTemplate size={14} color={colors.accent} />
          <Label color={colors.accent}>Modèles</Label>
        </Pressable>
      </View>

      <BlockList
        blocks={blocks}
        zones={settings.zones}
        vmaKmh={settings.vmaKmh}
        onChange={setBlocks}
        onEditStep={(blockId, step) => setEditing({ blockId, step })}
      />

      <View style={styles.addRow}>
        <Button
          label="Étape"
          variant="secondary"
          size="sm"
          icon={<Plus size={14} color={colors.text} />}
          onPress={() =>
            setBlocks((current) => [
              ...current,
              singleBlock(
                makeStep({
                  kind: 'run',
                  zoneId: defaultZone,
                  target: { type: 'time', seconds: 600 },
                }),
              ),
            ])
          }
        />
        <Button
          label="Série"
          variant="secondary"
          size="sm"
          icon={<Repeat size={14} color={colors.text} />}
          onPress={() =>
            setBlocks((current) => [
              ...current,
              repeatBlock(8, [
                makeStep({
                  kind: 'interval',
                  zoneId: preferredZoneId(settings.zones, ZONE_IDS.vma),
                  target: { type: 'distance', meters: 400 },
                }),
                makeStep({
                  kind: 'recovery',
                  zoneId: preferredZoneId(settings.zones, ZONE_IDS.recovery),
                  target: { type: 'time', seconds: 60 },
                }),
              ]),
            ])
          }
        />
      </View>

      <View style={styles.notesBlock}>
        <Label>Notes</Label>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Sensations attendues, lieu, matériel…"
          placeholderTextColor={colors.textFaint}
          multiline
          style={styles.notesInput}
          accessibilityLabel="Notes de la séance"
        />
      </View>

      {existing ? (
        <Button label="Supprimer la séance" variant="danger" full onPress={handleDelete} />
      ) : null}

      <StepEditorSheet
        step={editing?.step ?? null}
        zones={settings.zones}
        vmaKmh={settings.vmaKmh}
        onChange={applyStep}
        onDelete={deleteStep}
        onClose={() => setEditing(null)}
      />

      <Sheet visible={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Modèles">
        <Small style={styles.sheetHint}>
          Le modèle remplace la structure actuelle. Le nom et la date ne changent pas.
        </Small>
        {templates.map((template) => (
          <Row
            key={template.id}
            label={template.name}
            hint={template.builtin ? undefined : 'Modèle enregistré'}
            onPress={() => {
              setBlocks(cloneBlocks(template.blocks));
              setKind(template.kind);
              if (!name.trim()) setName(template.name);
              setTemplatesOpen(false);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={dateOpen} onClose={() => setDateOpen(false)} title="Date de la séance">
        {dateOptions.map((option) => (
          <Row
            key={option}
            label={labelDayFull(fromKey(option))}
            value={option === date ? '✓' : undefined}
            onPress={() => {
              setDate(option);
              setDateOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  nameInput: {
    ...typography.title,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.lg },
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  rows: { marginTop: spacing.md },
  rowInner: { paddingHorizontal: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  templateLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addRow: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  notesBlock: { gap: spacing.sm, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  notesInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  sheetHint: { paddingBottom: spacing.sm },
});
