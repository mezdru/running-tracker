import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { getActivity } from '@/entities/activity/repo';
import { ActivityReport } from '@/features/activity/ui/ActivityReport';
import { shareGpx } from '@/features/activity/gpx';
import { usePlanStore } from '@/features/plan/store';
import { fromKey, labelDayFull, toKey } from '@/shared/lib/date';
import { colors, spacing } from '@/shared/theme';
import { Button, EmptyState, Label, Row, Screen, Sheet, Small, Title } from '@/shared/ui';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ActivityDetail'>;
type DetailRoute = RouteProp<RootStackParamList, 'ActivityDetail'>;

export function ActivityDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<DetailRoute>();
  const settings = usePlanStore((state) => state.settings);
  const workouts = usePlanStore((state) => state.workouts);
  const linkActivity = usePlanStore((state) => state.linkActivity);
  const removeActivity = usePlanStore((state) => state.removeActivity);
  const summaries = usePlanStore((state) => state.activities);
  const [linkOpen, setLinkOpen] = useState(false);

  // La trace complète n'est pas dans la liste en mémoire : on relit la ligne.
  const activity = useMemo(() => getActivity(params.activityId), [params.activityId]);
  // La version en mémoire porte, elle, le lien à jour après association.
  const link = summaries.find((candidate) => candidate.id === params.activityId)?.workoutId ?? null;
  const workout = workouts.find((candidate) => candidate.id === link);

  if (!activity) {
    return (
      <Screen>
        <EmptyState
          title="Activité introuvable"
          action={<Button label="Retour" onPress={() => navigation.goBack()} />}
        />
      </Screen>
    );
  }

  const startedOn = toKey(new Date(activity.startedAt));
  // Les séances du même jour d'abord : c'est presque toujours celle qu'on veut
  // associer quand on a couru sans démarrer la séance depuis l'app.
  const candidates = [...workouts].sort((a, b) => {
    const score = (date: string) => Math.abs(new Date(date).getTime() - activity.startedAt);
    return score(a.date) - score(b.date);
  }).slice(0, 20);

  const handleDelete = () =>
    Alert.alert('Supprimer l’activité', 'La trace GPS sera définitivement perdue.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          removeActivity(activity.id);
          navigation.goBack();
        },
      },
    ]);

  const handleShare = async () => {
    try {
      await shareGpx(activity, workout?.name ?? 'Sortie libre');
    } catch (error) {
      Alert.alert(
        'Export impossible',
        error instanceof Error ? error.message : 'Le fichier GPX n’a pas pu être créé.',
      );
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={styles.back}
        >
          <ChevronLeft size={20} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={handleShare}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Exporter en GPX"
        >
          <Share2 size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <Label>{labelDayFull(fromKey(startedOn))}</Label>
        <Title>{workout?.name ?? 'Sortie libre'}</Title>
      </View>

      <ActivityReport activity={activity} zones={settings.zones} />

      <View style={styles.actions}>
        <Button
          label={workout ? 'Changer la séance associée' : 'Associer à une séance'}
          variant="secondary"
          full
          onPress={() => setLinkOpen(true)}
        />
        <Button label="Exporter en GPX" variant="secondary" full onPress={handleShare} />
        <Button label="Supprimer l’activité" variant="danger" full onPress={handleDelete} />
      </View>

      <Sheet visible={linkOpen} onClose={() => setLinkOpen(false)} title="Associer à une séance">
        <Small style={styles.hint}>
          Associer marque la séance comme faite et compare le réalisé aux allures visées.
        </Small>
        {link ? (
          <Row
            label="Dissocier"
            danger
            onPress={() => {
              linkActivity(activity.id, null);
              setLinkOpen(false);
            }}
          />
        ) : null}
        {candidates.map((candidate) => (
          <Row
            key={candidate.id}
            label={candidate.name}
            hint={labelDayFull(fromKey(candidate.date))}
            value={candidate.id === link ? '✓' : undefined}
            onPress={() => {
              linkActivity(activity.id, candidate.id);
              setLinkOpen(false);
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
  },
  back: { marginLeft: -spacing.xs },
  titleBlock: { paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.xs },
  actions: { gap: spacing.sm, paddingTop: spacing.xl },
  hint: { paddingBottom: spacing.sm },
});
