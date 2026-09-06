import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Play, Zap } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { KIND_COLOR, summarizeBlocks } from '@/entities/workout/display';
import { WORKOUT_KIND_LABEL, type Workout } from '@/entities/workout/model';
import { usePlanStore } from '@/features/plan/store';
import { fromKey, labelDayFull, todayKey } from '@/shared/lib/date';
import { formatDurationShort, formatKm } from '@/shared/lib/format';
import { colors, spacing } from '@/shared/theme';
import { Body, Button, Card, Chip, Heading, Label, Screen, Small, Title } from '@/shared/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Écran de départ : ce qui est prévu aujourd'hui, ou une sortie libre. */
export function RunSetupScreen() {
  const navigation = useNavigation<Nav>();
  const workouts = usePlanStore((state) => state.workouts);
  const today = todayKey();

  const todays = useMemo(
    () => workouts.filter((workout) => workout.date === today),
    [workouts, today],
  );
  // Les prochaines séances, pour les jours où l'on avance ou décale une sortie.
  const upcoming = useMemo(
    () => workouts.filter((workout) => workout.date > today).slice(0, 4),
    [workouts, today],
  );

  const renderWorkout = (workout: Workout, upcomingLabel?: string) => (
    <Card key={workout.id} accent={KIND_COLOR[workout.kind]} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitle}>
          <Heading numberOfLines={1}>{workout.name}</Heading>
          <Small>{summarizeBlocks(workout.blocks) || 'Séance vide'}</Small>
        </View>
        <Chip label={WORKOUT_KIND_LABEL[workout.kind]} color={KIND_COLOR[workout.kind]} compact />
      </View>

      <View style={styles.metrics}>
        <Body style={styles.metric}>{formatKm(workout.estDistanceM)} km</Body>
        <Small style={styles.dot}>·</Small>
        <Body style={styles.metric}>{formatDurationShort(workout.estDurationS)}</Body>
        {upcomingLabel ? <Small style={styles.when}>{upcomingLabel}</Small> : null}
      </View>

      <Button
        label={workout.done ? 'Refaire cette séance' : 'Démarrer'}
        full
        icon={<Play size={16} color={colors.accentInk} fill={colors.accentInk} />}
        onPress={() => navigation.navigate('RunSession', { workoutId: workout.id })}
      />
    </Card>
  );

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Label>{labelDayFull(fromKey(today))}</Label>
        <Title>Courir</Title>
      </View>

      {todays.length > 0 ? (
        <View style={styles.section}>{todays.map((workout) => renderWorkout(workout))}</View>
      ) : (
        <Card style={styles.card}>
          <Heading>Rien de prévu aujourd’hui</Heading>
          <Small>
            Vous pouvez partir en sortie libre : la distance, l’allure et le tracé sont
            enregistrés de la même façon.
          </Small>
        </Card>
      )}

      {/* Sans séance du jour, partir en sortie libre est LE geste de l'écran :
          il prend la couleur d'action. Dès qu'une séance est prévue, il
          redevient secondaire pour ne pas concurrencer son bouton. */}
      <View style={styles.section}>
        <Button
          label="Sortie libre"
          variant={todays.length > 0 ? 'secondary' : 'primary'}
          full
          icon={
            <Zap
              size={16}
              color={todays.length > 0 ? colors.text : colors.accentInk}
              fill={todays.length > 0 ? 'transparent' : colors.accentInk}
            />
          }
          onPress={() => navigation.navigate('RunSession', {})}
        />
      </View>

      {upcoming.length > 0 ? (
        <View style={styles.section}>
          <Label>À venir</Label>
          {upcoming.map((workout) =>
            renderWorkout(workout, labelDayFull(fromKey(workout.date))),
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.xs },
  section: { gap: spacing.md, paddingBottom: spacing.xl },
  card: { gap: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardTitle: { flex: 1, gap: spacing.xs },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metric: { fontWeight: '700' },
  dot: { color: colors.textMuted },
  when: { marginLeft: 'auto', color: colors.textFaint, textTransform: 'capitalize' },
});
