import { StyleSheet, Text, View } from 'react-native';

import { KIND_COLOR } from '@/entities/workout/display';
import type { Workout } from '@/entities/workout/model';
import { isInMonth, labelDayShort, monthGrid, toKey, weekDays, type DayKey } from '@/shared/lib/date';
import { formatKm } from '@/shared/lib/format';
import { colors, radius, spacing, type as typography } from '@/shared/theme';

import { DayCell } from './DayCell';

type Props = {
  month: Date;
  selected: DayKey;
  today: DayKey;
  workouts: Workout[];
  onSelect: (day: DayKey) => void;
};

/**
 * Grille mensuelle. Chaque case porte les pastilles des séances du jour et son
 * kilométrage ; la colonne de droite donne le total de la semaine. C'est cette
 * colonne qui fait la valeur de la vue mensuelle — elle montre la charge
 * hebdomadaire monter et redescendre sur un cycle entier.
 */
export function MonthCalendar({ month, selected, today, workouts, onSelect }: Props) {
  const grid = monthGrid(month);
  const byDay = new Map<DayKey, Workout[]>();
  for (const workout of workouts) {
    const list = byDay.get(workout.date);
    if (list) list.push(workout);
    else byDay.set(workout.date, [workout]);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        {weekDays(grid[0][0]).map((day) => (
          <Text key={toKey(day)} style={[typography.label, styles.headerCell]}>
            {labelDayShort(day)}
          </Text>
        ))}
        <Text style={[typography.label, styles.headerTotal]}>KM</Text>
      </View>

      {grid.map((week) => {
        const weekTotal = week.reduce(
          (sum, day) =>
            sum + (byDay.get(toKey(day)) ?? []).reduce((s, w) => s + w.estDistanceM, 0),
          0,
        );
        return (
          <View key={toKey(week[0])} style={styles.week}>
            {week.map((day) => {
              const key = toKey(day);
              return (
                <DayCell
                  key={key}
                  day={day}
                  workouts={byDay.get(key) ?? []}
                  dimmed={!isInMonth(day, month)}
                  selected={key === selected}
                  isToday={key === today}
                  onPress={() => onSelect(key)}
                />
              );
            })}
            <View style={styles.weekTotal}>
              <Text
                style={[
                  typography.small,
                  { color: weekTotal > 0 ? colors.textMuted : colors.textFaint },
                ]}
              >
                {weekTotal > 0 ? formatKm(weekTotal, 0) : '–'}
              </Text>
            </View>
          </View>
        );
      })}

      <View style={styles.legend}>
        {(
          [
            ['easy', 'Footing'],
            ['intervals', 'Fractionné'],
            ['tempo', 'Seuil'],
            ['long', 'Longue'],
          ] as const
        ).map(([kind, label]) => (
          <View key={kind} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: KIND_COLOR[kind] }]} />
            <Text style={[typography.label, { color: colors.textFaint }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  headerRow: { flexDirection: 'row', paddingBottom: spacing.sm },
  headerCell: { flex: 1, textAlign: 'center', color: colors.textFaint },
  headerTotal: { width: 30, textAlign: 'center', color: colors.textFaint },
  week: { flexDirection: 'row', alignItems: 'stretch' },
  weekTotal: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 7, height: 7, borderRadius: radius.pill },
});
