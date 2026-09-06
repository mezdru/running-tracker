import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Play,
  Target,
  Trash2,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { activePlan, planCovers, planMondays } from '@/entities/plan/model';
import { saveUserTemplate } from '@/entities/workout/templates';
import type { Workout } from '@/entities/workout/model';
import { DayRow } from '@/features/plan/ui/DayRow';
import { MonthCalendar } from '@/features/plan/ui/MonthCalendar';
import { WeekTotals } from '@/features/plan/ui/WeekTotals';
import { WorkoutCard } from '@/features/plan/ui/WorkoutCard';
import { mondayOf, usePlanStore, weekSummary, workoutsOn } from '@/features/plan/store';
import {
  addWeeks,
  fromKey,
  labelDayFull,
  labelMonth,
  labelWeek,
  labelWeekNumber,
  shiftKey,
  shiftMonth,
  toKey,
  todayKey,
  weekDays,
  weekKey,
  type DayKey,
} from '@/shared/lib/date';
import { formatKm } from '@/shared/lib/format';
import { colors, radius, spacing } from '@/shared/theme';
import { Body, Button, Card, Label, Row, Screen, Segmented, Sheet, Small, Title } from '@/shared/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Mode = 'month' | 'week';

export function PlanScreen() {
  const navigation = useNavigation<Nav>();
  const workouts = usePlanStore((state) => state.workouts);
  const activities = usePlanStore((state) => state.activities);
  const clipboard = usePlanStore((state) => state.clipboard);
  const plans = usePlanStore((state) => state.plans);
  const store = usePlanStore();

  const today = todayKey();
  const [mode, setMode] = useState<Mode>('week');
  const [selected, setSelected] = useState<DayKey>(today);
  const [month, setMonth] = useState(() => fromKey(today));
  const [monday, setMonday] = useState<DayKey>(() => weekKey(fromKey(today)));
  const [actionsFor, setActionsFor] = useState<Workout | null>(null);

  const summary = useMemo(
    () => weekSummary(workouts, activities, monday),
    [workouts, activities, monday],
  );

  // Plan en cours et rang de la semaine affichée dans ce plan. Le bandeau ne
  // s'affiche que si la semaine regardée appartient au plan : au-delà, il
  // donnerait un « S14/12 » qui n'existe pas.
  const plan = activePlan(plans, today);
  const planWeekIndex = plan ? planMondays(plan).indexOf(monday) : -1;
  const planTargetM = plan && planWeekIndex >= 0 ? plan.weeklyTargetsM[planWeekIndex] ?? 0 : 0;
  const days = useMemo(() => weekDays(fromKey(monday)), [monday]);
  const selectedWorkouts = workoutsOn(workouts, selected);

  const goToday = () => {
    setSelected(today);
    setMonth(fromKey(today));
    setMonday(weekKey(fromKey(today)));
  };

  const step = (delta: number) => {
    if (mode === 'month') setMonth((current) => shiftMonth(current, delta));
    else setMonday((current) => toKey(addWeeks(fromKey(current), delta)));
  };

  const openEditor = (workout: Workout) =>
    navigation.navigate('WorkoutEditor', { workoutId: workout.id });
  const addOn = (date: DayKey) => navigation.navigate('WorkoutEditor', { date });

  const handlePaste = () => {
    if (!clipboard) return;
    const existing = days.map(toKey).some((day) => workouts.some((w) => w.date === day));
    if (!existing) {
      store.pasteWeek(monday, 'merge');
      return;
    }
    // La semaine cible n'est pas vide : écraser ou ajouter n'est pas la même
    // chose, et se tromper coûte un plan entier. On demande.
    Alert.alert(
      'Coller la semaine',
      `${clipboard.items.length} séance(s) copiée(s) depuis la semaine du ${labelWeek(
        fromKey(clipboard.sourceMonday),
      )}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Ajouter', onPress: () => store.pasteWeek(monday, 'merge') },
        {
          text: 'Remplacer',
          style: 'destructive',
          onPress: () => store.pasteWeek(monday, 'replace'),
        },
      ],
    );
  };

  const handleClearWeek = () => {
    const count = days.map(toKey).reduce(
      (sum, day) => sum + workouts.filter((w) => w.date === day).length,
      0,
    );
    if (count === 0) return;
    Alert.alert('Vider la semaine', `Supprimer les ${count} séances de cette semaine ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => store.clearWeek(monday) },
    ]);
  };

  const handleDelete = (workout: Workout) => {
    setActionsFor(null);
    Alert.alert('Supprimer la séance', `« ${workout.name} » sera définitivement supprimée.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => store.removeWorkout(workout.id) },
    ]);
  };

  const handleSaveTemplate = (workout: Workout) => {
    setActionsFor(null);
    saveUserTemplate(workout.name, workout.kind, workout.blocks);
    Alert.alert('Modèle enregistré', `« ${workout.name} » est disponible dans les modèles.`);
  };

  const title = mode === 'month' ? labelMonth(month) : labelWeekNumber(fromKey(monday));
  const subtitle = mode === 'month' ? null : labelWeek(fromKey(monday));

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Title style={styles.title}>{title.charAt(0).toUpperCase() + title.slice(1)}</Title>
          {subtitle ? <Small>{subtitle}</Small> : null}
        </View>
        <View style={styles.navButtons}>
          <Pressable
            onPress={() => step(-1)}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Période précédente"
          >
            <ChevronLeft size={18} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => step(1)}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Période suivante"
          >
            <ChevronRight size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.segmented}>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'week', label: 'Semaine' },
              { value: 'month', label: 'Mois' },
            ]}
          />
        </View>
        <Button label="Aujourd’hui" variant="secondary" size="sm" onPress={goToday} />
      </View>

      {plan ? (
        <Card
          style={styles.planBanner}
          accent={colors.accent}
          onPress={() => navigation.navigate('PlanDetail', { planId: plan.id })}
        >
          <View style={styles.planText}>
            <Label color={colors.accent}>
              {planWeekIndex >= 0
                ? `Semaine ${planWeekIndex + 1} / ${plan.weeks}`
                : planCovers(plan, today)
                  ? 'Plan en cours'
                  : 'Plan à venir'}
            </Label>
            <Body style={styles.planName} numberOfLines={1}>
              {plan.name}
            </Body>
          </View>
          {planTargetM > 0 ? (
            <View style={styles.planTarget}>
              <Small style={styles.planTargetValue}>{formatKm(planTargetM, 0)} km</Small>
              <Label>Objectif</Label>
            </View>
          ) : null}
        </Card>
      ) : (
        <Button
          label="Créer un plan d’entraînement"
          variant="secondary"
          size="sm"
          full
          style={styles.planBanner}
          icon={<Target size={14} color={colors.text} />}
          onPress={() => navigation.navigate('PlanBuilder')}
        />
      )}

      {mode === 'month' ? (
        <View style={styles.section}>
          <MonthCalendar
            month={month}
            selected={selected}
            today={today}
            workouts={workouts}
            onSelect={(day) => {
              setSelected(day);
              setMonday(mondayOf(day));
            }}
          />

          <View style={styles.dayHeader}>
            <Label>{labelDayFull(fromKey(selected))}</Label>
            <Button
              label="Ajouter"
              size="sm"
              variant="secondary"
              icon={<CalendarPlus size={14} color={colors.text} />}
              onPress={() => addOn(selected)}
            />
          </View>

          {selectedWorkouts.length === 0 ? (
            <Body style={styles.restDay}>Repos</Body>
          ) : (
            <View style={styles.list}>
              {selectedWorkouts.map((workout) => (
                <WorkoutCard
                  key={workout.id}
                  workout={workout}
                  onPress={() => openEditor(workout)}
                  onToggleDone={() => store.toggleDone(workout.id)}
                  onMore={() => setActionsFor(workout)}
                  onDuplicate={() => store.duplicateWorkout(workout.id)}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <WeekTotals summary={summary} />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekActions}
          >
            <Button
              label="Copier"
              size="sm"
              variant="secondary"
              icon={<Copy size={14} color={colors.text} />}
              onPress={() => {
                const count = store.copyWeek(monday);
                Alert.alert(
                  'Semaine copiée',
                  count === 0
                    ? 'Cette semaine ne contient aucune séance.'
                    : `${count} séance(s) prêtes à être collées.`,
                );
              }}
            />
            <Button
              label={clipboard ? `Coller (${clipboard.items.length})` : 'Coller'}
              size="sm"
              variant="secondary"
              disabled={!clipboard || clipboard.items.length === 0}
              icon={<ClipboardPaste size={14} color={colors.text} />}
              onPress={handlePaste}
            />
            <Button
              label="Décaler d’une semaine"
              size="sm"
              variant="secondary"
              onPress={() =>
                Alert.alert(
                  'Décaler le plan',
                  'Toutes les séances à partir de cette semaine seront déplacées.',
                  [
                    { text: 'Annuler', style: 'cancel' },
                    { text: '← Avancer', onPress: () => store.shiftPlan(monday, -1) },
                    { text: 'Reculer →', onPress: () => store.shiftPlan(monday, 1) },
                  ],
                )
              }
            />
            <Button
              label="Vider"
              size="sm"
              variant="danger"
              icon={<Trash2 size={14} color={colors.danger} />}
              onPress={handleClearWeek}
            />
          </ScrollView>

          <View style={styles.days}>
            {days.map((day) => (
              <DayRow
                key={toKey(day)}
                day={day}
                today={today}
                workouts={workoutsOn(workouts, toKey(day))}
                onAdd={addOn}
                onOpen={openEditor}
                onToggleDone={(workout) => store.toggleDone(workout.id)}
                onMore={setActionsFor}
                onDuplicate={(workout) => store.duplicateWorkout(workout.id)}
              />
            ))}
          </View>
        </View>
      )}

      <Sheet
        visible={actionsFor !== null}
        onClose={() => setActionsFor(null)}
        title={actionsFor?.name ?? ''}
      >
        {actionsFor ? (
          <View>
            <Row
              label="Démarrer cette séance"
              left={<Play size={18} color={colors.accent} />}
              onPress={() => {
                const workoutId = actionsFor.id;
                setActionsFor(null);
                navigation.navigate('RunSession', { workoutId });
              }}
            />
            <Row
              label="Modifier"
              onPress={() => {
                const workout = actionsFor;
                setActionsFor(null);
                openEditor(workout);
              }}
            />
            <Row
              label="Dupliquer le lendemain"
              onPress={() => {
                store.duplicateWorkout(actionsFor.id, shiftKey(actionsFor.date, 1));
                setActionsFor(null);
              }}
            />
            <Row
              label="Dupliquer la semaine suivante"
              onPress={() => {
                store.duplicateWorkout(actionsFor.id, shiftKey(actionsFor.date, 7));
                setActionsFor(null);
              }}
            />
            <Row
              label="Déplacer au lendemain"
              onPress={() => {
                store.moveWorkout(actionsFor.id, shiftKey(actionsFor.date, 1));
                setActionsFor(null);
              }}
            />
            <Row
              label="Enregistrer comme modèle"
              onPress={() => handleSaveTemplate(actionsFor)}
            />
            <Row label="Supprimer" danger onPress={() => handleDelete(actionsFor)} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerText: { flex: 1, gap: 2 },
  title: { textTransform: 'capitalize' },
  navButtons: { flexDirection: 'row', gap: spacing.sm },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  planBanner: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planText: { flex: 1, gap: 2 },
  planName: { fontWeight: '700' },
  planTarget: { alignItems: 'flex-end' },
  planTargetValue: { color: colors.text, fontWeight: '800' },
  segmented: { flex: 1 },
  section: { gap: spacing.lg, paddingTop: spacing.lg },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  list: { gap: spacing.sm },
  restDay: { color: colors.textFaint },
  weekActions: { gap: spacing.sm, paddingRight: spacing.lg },
  days: { gap: spacing.xl },
});
