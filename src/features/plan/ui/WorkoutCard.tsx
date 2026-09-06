import { Check, Copy, MoreHorizontal } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { KIND_COLOR, summarizeBlocks } from '@/entities/workout/display';
import { WORKOUT_KIND_LABEL, type Workout } from '@/entities/workout/model';
import { formatDurationShort, formatKm } from '@/shared/lib/format';
import { colors, radius, spacing } from '@/shared/theme';
import { Body, Card, Chip, Small } from '@/shared/ui';

type Props = {
  workout: Workout;
  onPress: () => void;
  onToggleDone: () => void;
  onMore: () => void;
  onDuplicate?: () => void;
};

/** Carte de séance, telle qu'elle apparaît dans le jour et dans la semaine. */
export function WorkoutCard({ workout, onPress, onToggleDone, onMore, onDuplicate }: Props) {
  const color = KIND_COLOR[workout.kind];
  return (
    <Card accent={color} onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Body numberOfLines={1} style={styles.name}>
            {workout.name}
          </Body>
          <Small numberOfLines={1}>{summarizeBlocks(workout.blocks) || 'Séance vide'}</Small>
        </View>
        <Pressable
          onPress={onToggleDone}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: workout.done }}
          accessibilityLabel={workout.done ? 'Marquer comme non faite' : 'Marquer comme faite'}
          style={[styles.check, workout.done && { backgroundColor: color, borderColor: color }]}
        >
          {workout.done ? <Check size={14} color={colors.accentInk} strokeWidth={3} /> : null}
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Chip label={WORKOUT_KIND_LABEL[workout.kind]} color={color} compact />
        <Small style={styles.metric}>{formatKm(workout.estDistanceM)} km</Small>
        <Small style={styles.dot}>·</Small>
        <Small style={styles.metric}>{formatDurationShort(workout.estDurationS)}</Small>
        <View style={styles.spacer} />
        {onDuplicate ? (
          <Pressable
            onPress={onDuplicate}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Dupliquer la séance"
          >
            <Copy size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onMore}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Actions sur la séance"
        >
          <MoreHorizontal size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titleBlock: { flex: 1, gap: 2 },
  name: { fontWeight: '700' },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metric: { color: colors.text, fontWeight: '600' },
  dot: { color: colors.textMuted },
  spacer: { flex: 1 },
});
