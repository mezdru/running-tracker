import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import {
  DEFAULT_SHAPE,
  PLAN_GOALS,
  PLAN_GOAL_LABEL,
  weeklyTargets,
  type PlanGoal,
  type PlanShape,
  type TrainingPlan,
} from '@/entities/plan/model';
import { usePlanStore } from '@/features/plan/store';
import {
  addWeeks,
  fromKey,
  labelDayFull,
  labelWeek,
  shiftKey,
  toKey,
  todayKey,
  weekStart,
} from '@/shared/lib/date';
import { formatKm } from '@/shared/lib/format';
import { newId } from '@/shared/lib/id';
import { colors, radius, spacing, type as typography } from '@/shared/theme';
import { Body, Button, Card, Chip, Label, Row, Screen, Sheet, Small, Stat, Stepper } from '@/shared/ui';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PlanBuilder'>;
type BuilderRoute = RouteProp<RootStackParamList, 'PlanBuilder'>;

const GOAL_DEFAULT_NAME: Record<PlanGoal, string> = {
  '5k': 'Préparation 5 km',
  '10k': 'Préparation 10 km',
  semi: 'Préparation semi-marathon',
  marathon: 'Préparation marathon',
  trail: 'Préparation trail',
  forme: 'Reprise en forme',
};

/**
 * Création et modification du CADRE d'un plan : objectif, durée, montée en
 * charge. Le plan ne crée aucune séance — c'est délibéré. Il pose des
 * objectifs hebdomadaires que l'on remplit soi-même, séance par séance, avec
 * les outils qui existent déjà (modèles, copie de semaine). Un plan qui
 * générerait les séances à votre place serait un entraîneur ; ce n'en est pas
 * un, et il ne prétend pas l'être.
 */
export function PlanBuilderScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<BuilderRoute>();
  const plans = usePlanStore((state) => state.plans);
  const upsertPlan = usePlanStore((state) => state.upsertPlan);

  const existing = params?.planId ? plans.find((plan) => plan.id === params.planId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [goal, setGoal] = useState<PlanGoal>(existing?.goal ?? 'semi');
  const [startMonday, setStartMonday] = useState(
    existing?.startMonday ?? toKey(weekStart(addWeeks(fromKey(todayKey()), 1))),
  );
  const [raceDate, setRaceDate] = useState<string | null>(existing?.raceDate ?? null);
  const [shape, setShape] = useState<PlanShape>(() =>
    existing
      ? { ...DEFAULT_SHAPE, weeks: existing.weeks, startVolumeM: existing.weeklyTargetsM[0] ?? DEFAULT_SHAPE.startVolumeM }
      : DEFAULT_SHAPE,
  );
  const [startOpen, setStartOpen] = useState(false);
  const [raceOpen, setRaceOpen] = useState(false);

  const targets = useMemo(() => weeklyTargets(shape), [shape]);
  const total = targets.reduce((sum, value) => sum + value, 0);
  const peak = Math.max(...targets);
  const lastMonday = shiftKey(startMonday, (shape.weeks - 1) * 7);

  // Lundis proposés : de la semaine en cours à six mois devant. Au-delà, on ne
  // prépare plus, on rêve.
  const mondayOptions = useMemo(() => {
    const first = toKey(weekStart(fromKey(todayKey())));
    return Array.from({ length: 27 }, (_, i) => shiftKey(first, i * 7));
  }, []);

  const raceOptions = useMemo(
    () => Array.from({ length: 21 }, (_, i) => shiftKey(lastMonday, i - 7)),
    [lastMonday],
  );

  const save = () => {
    const now = Date.now();
    const plan: TrainingPlan = {
      id: existing?.id ?? newId('plan'),
      name: name.trim() || GOAL_DEFAULT_NAME[goal],
      goal,
      startMonday,
      weeks: shape.weeks,
      raceDate,
      // Les objectifs déjà ajustés à la main sont conservés tant que le nombre
      // de semaines ne change pas : régler le cadre ne doit pas effacer un
      // réglage plus fin fait ensuite.
      weeklyTargetsM:
        existing && existing.weeks === shape.weeks && existing.weeklyTargetsM.length === shape.weeks
          ? existing.weeklyTargetsM
          : targets,
      notes: existing?.notes ?? '',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    upsertPlan(plan);
    navigation.goBack();
  };

  const alignOnRace = (date: string) => {
    setRaceDate(date);
    // Le plan se termine la semaine de la course : c'est ce qu'on veut dans
    // 100 % des cas, autant le faire plutôt que de le demander.
    const raceMonday = toKey(weekStart(fromKey(date)));
    setStartMonday(shiftKey(raceMonday, -(shape.weeks - 1) * 7));
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Button label="Annuler" variant="ghost" size="sm" onPress={() => navigation.goBack()} />
        <Button label={existing ? 'Enregistrer' : 'Créer le plan'} size="sm" onPress={save} />
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={GOAL_DEFAULT_NAME[goal]}
        placeholderTextColor={colors.textFaint}
        style={styles.nameInput}
        accessibilityLabel="Nom du plan"
        returnKeyType="done"
      />

      <View style={styles.goals}>
        {PLAN_GOALS.map((option) => (
          <Chip
            key={option}
            label={PLAN_GOAL_LABEL[option]}
            active={goal === option}
            color={colors.accent}
            onPress={() => setGoal(option)}
          />
        ))}
      </View>

      <Card style={styles.summary}>
        <Stat value={String(shape.weeks)} label="Semaines" />
        <Stat value={formatKm(total, 0)} unit="km" label="Total" />
        <Stat value={formatKm(peak, 0)} unit="km" label="Pic" />
      </Card>

      <Card padded={false} style={styles.rows}>
        <View style={styles.rowInner}>
          <Row
            label="Première semaine"
            value={labelWeek(fromKey(startMonday))}
            onPress={() => setStartOpen(true)}
          />
          <Row
            label="Date de course"
            value={raceDate ? labelDayFull(fromKey(raceDate)) : 'Aucune'}
            onPress={() => setRaceOpen(true)}
          />
        </View>
      </Card>

      <Label style={styles.sectionLabel}>Montée en charge</Label>

      <Card style={styles.control}>
        <Stepper
          label="Nombre de semaines"
          value={shape.weeks}
          onChange={(weeks) => setShape({ ...shape, weeks })}
          step={1}
          min={2}
          max={40}
          format={(value) => `${value} semaines`}
        />
        <Stepper
          label="Volume de la première semaine"
          value={shape.startVolumeM}
          onChange={(startVolumeM) => setShape({ ...shape, startVolumeM })}
          step={2500}
          min={5000}
          max={200000}
          format={(value) => `${formatKm(value, 0)} km`}
        />
        <Stepper
          label="Progression par semaine"
          value={shape.progressionPercent}
          onChange={(progressionPercent) => setShape({ ...shape, progressionPercent })}
          step={1}
          min={0}
          max={20}
          format={(value) => `+ ${value} %`}
        />
        {shape.progressionPercent > 10 ? (
          <Small style={styles.warning}>
            Au-delà de 10 % par semaine, la hausse de charge est habituellement associée à un
            risque de blessure plus élevé.
          </Small>
        ) : null}
      </Card>

      <Card style={styles.control}>
        <Stepper
          label="Semaine d’assimilation"
          value={shape.recoveryEvery}
          onChange={(recoveryEvery) => setShape({ ...shape, recoveryEvery })}
          step={1}
          min={0}
          max={8}
          format={(value) => (value === 0 ? 'Aucune' : `Toutes les ${value} semaines`)}
        />
        {shape.recoveryEvery > 0 ? (
          <Stepper
            label="Allègement"
            value={shape.recoveryDropPercent}
            onChange={(recoveryDropPercent) => setShape({ ...shape, recoveryDropPercent })}
            step={5}
            min={10}
            max={60}
            format={(value) => `− ${value} %`}
          />
        ) : null}
        <Stepper
          label="Affûtage avant la course"
          value={shape.taperWeeks}
          onChange={(taperWeeks) => setShape({ ...shape, taperWeeks })}
          step={1}
          min={0}
          max={4}
          format={(value) => (value === 0 ? 'Aucun' : `${value} semaine${value > 1 ? 's' : ''}`)}
        />
      </Card>

      <Label style={styles.sectionLabel}>Aperçu</Label>
      <Card padded={false} style={styles.preview}>
        {targets.map((target, index) => (
          <View key={index} style={styles.previewRow}>
            <Small style={styles.previewWeek}>
              S{index + 1} · {labelWeek(fromKey(shiftKey(startMonday, index * 7)))}
            </Small>
            <View style={styles.previewTrack}>
              <View
                style={[styles.previewFill, { width: `${Math.max(3, (target / peak) * 100)}%` }]}
              />
            </View>
            <Body style={styles.previewValue}>{formatKm(target, 0)}</Body>
          </View>
        ))}
      </Card>
      <Small style={styles.footnote}>
        Ces objectifs se modifient semaine par semaine une fois le plan créé. Le plan ne crée
        aucune séance : il donne la cible, vous posez les séances.
      </Small>

      {existing ? (
        <Button
          label="Supprimer le plan"
          variant="danger"
          full
          style={styles.delete}
          onPress={() =>
            Alert.alert(
              'Supprimer le plan',
              'Les séances déjà saisies restent au calendrier : seul le cadre est supprimé.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Supprimer',
                  style: 'destructive',
                  onPress: () => {
                    usePlanStore.getState().removePlan(existing.id);
                    navigation.goBack();
                  },
                },
              ],
            )
          }
        />
      ) : null}

      <Sheet visible={startOpen} onClose={() => setStartOpen(false)} title="Première semaine">
        {mondayOptions.map((monday) => (
          <Row
            key={monday}
            label={labelWeek(fromKey(monday))}
            value={monday === startMonday ? '✓' : undefined}
            onPress={() => {
              setStartMonday(monday);
              setStartOpen(false);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={raceOpen} onClose={() => setRaceOpen(false)} title="Date de course">
        <Small style={styles.sheetHint}>
          Choisir une date cale le plan pour qu’il se termine la semaine de la course.
        </Small>
        {raceDate ? (
          <Row label="Aucune course" danger onPress={() => { setRaceDate(null); setRaceOpen(false); }} />
        ) : null}
        {raceOptions.map((date) => (
          <Row
            key={date}
            label={labelDayFull(fromKey(date))}
            value={date === raceDate ? '✓' : undefined}
            onPress={() => {
              alignOnRace(date);
              setRaceOpen(false);
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
  nameInput: { ...typography.title, color: colors.text, paddingVertical: spacing.sm },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.lg },
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  rows: { marginTop: spacing.md },
  rowInner: { paddingHorizontal: spacing.lg },
  sectionLabel: { paddingTop: spacing.xl, paddingBottom: spacing.sm },
  control: { gap: spacing.lg, marginBottom: spacing.sm },
  warning: { color: colors.warning },
  preview: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 5 },
  previewWeek: { width: 118 },
  previewTrack: {
    flex: 1,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  previewFill: { height: 7, borderRadius: radius.pill, backgroundColor: colors.accent },
  previewValue: { width: 34, textAlign: 'right', fontWeight: '700', fontVariant: ['tabular-nums'] },
  footnote: { paddingTop: spacing.md },
  sheetHint: { paddingBottom: spacing.sm },
  delete: { marginTop: spacing.xl },
});
