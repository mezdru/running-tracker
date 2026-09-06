import { Pressable, StyleSheet, Text, View } from 'react-native';

import { KIND_COLOR } from '@/entities/workout/display';
import type { Workout } from '@/entities/workout/model';
import { labelDayFull } from '@/shared/lib/date';
import { formatKm } from '@/shared/lib/format';
import { colors, radius, spacing, type as typography } from '@/shared/theme';

type Props = {
  day: Date;
  workouts: Workout[];
  dimmed: boolean;
  selected: boolean;
  isToday: boolean;
  onPress: () => void;
};

/** Une case du calendrier : le quantième, les pastilles, le kilométrage. */
export function DayCell({ day, workouts, dimmed, selected, isToday, onPress }: Props) {
  const distance = workouts.reduce((sum, workout) => sum + workout.estDistanceM, 0);
  const allDone = workouts.length > 0 && workouts.every((workout) => workout.done);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${labelDayFull(day)}, ${
        workouts.length === 0 ? 'aucune séance' : `${workouts.length} séance(s)`
      }`}
      style={({ pressed }) => [
        styles.cell,
        selected && styles.selected,
        { opacity: pressed ? 0.6 : dimmed ? 0.32 : 1 },
      ]}
    >
      <Text
        style={[
          typography.small,
          styles.number,
          isToday && { color: colors.accent, fontWeight: '800' },
        ]}
      >
        {day.getDate()}
      </Text>

      <View style={styles.dots}>
        {/* Au-delà de trois séances dans la journée, les pastilles ne diraient
            plus rien : le compte prend le relais dans le détail du jour. */}
        {workouts.slice(0, 3).map((workout) => (
          <View
            key={workout.id}
            style={[
              styles.dot,
              {
                backgroundColor: workout.done ? 'transparent' : KIND_COLOR[workout.kind],
                borderColor: KIND_COLOR[workout.kind],
              },
            ]}
          />
        ))}
      </View>

      <Text
        style={[
          typography.label,
          styles.km,
          { color: allDone ? colors.success : colors.textFaint },
        ]}
        numberOfLines={1}
      >
        {distance > 0 ? formatKm(distance, 0) : ' '}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    gap: 3,
  },
  selected: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  number: { color: colors.text, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 3, height: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: radius.pill, borderWidth: 1.5 },
  km: { marginTop: spacing.xs - 2 },
});
