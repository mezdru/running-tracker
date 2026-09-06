import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Workout } from '@/entities/workout/model';
import { labelDayFull, toKey, type DayKey } from '@/shared/lib/date';
import { colors, radius, spacing } from '@/shared/theme';
import { Label, Small } from '@/shared/ui';

import { WorkoutCard } from './WorkoutCard';

type Props = {
  day: Date;
  today: DayKey;
  workouts: Workout[];
  onAdd: (date: DayKey) => void;
  onOpen: (workout: Workout) => void;
  onToggleDone: (workout: Workout) => void;
  onMore: (workout: Workout) => void;
  onDuplicate: (workout: Workout) => void;
};

/** Une journée de la vue semaine : son intitulé, ses séances, son bouton d'ajout. */
export function DayRow({
  day,
  today,
  workouts,
  onAdd,
  onOpen,
  onToggleDone,
  onMore,
  onDuplicate,
}: Props) {
  const key = toKey(day);
  const isToday = key === today;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Label color={isToday ? colors.accent : colors.textFaint}>
          {labelDayFull(day)}
          {isToday ? " · aujourd'hui" : ''}
        </Label>
        <Pressable
          onPress={() => onAdd(key)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter une séance le ${labelDayFull(day)}`}
          style={styles.add}
        >
          <Plus size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      {workouts.length === 0 ? (
        <Pressable
          onPress={() => onAdd(key)}
          style={styles.rest}
          accessibilityRole="button"
          accessibilityLabel={`Repos, ajouter une séance le ${labelDayFull(day)}`}
        >
          <Small>Repos</Small>
        </Pressable>
      ) : (
        <View style={styles.list}>
          {workouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              onPress={() => onOpen(workout)}
              onToggleDone={() => onToggleDone(workout)}
              onMore={() => onMore(workout)}
              onDuplicate={() => onDuplicate(workout)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  add: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: spacing.sm },
  rest: {
    borderRadius: radius.md,
    borderWidth: 1,
    // Contour porteur : c'est lui, et rien d'autre, qui dit que la journée
    // vide se touche pour y ajouter une séance.
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    // 44 pt de haut : la zone se vise sans regarder.
    minHeight: 44,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
