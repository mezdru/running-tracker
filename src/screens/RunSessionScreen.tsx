import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import { ChevronRight, Pause, Play, Satellite, Square } from 'lucide-react-native';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { findZone } from '@/entities/pace/model';
import { usePlanStore } from '@/features/plan/store';
import { stepProgress, stepRemaining } from '@/features/run/engine';
import { currentStep, nextStep, useRunStore } from '@/features/run/store';
import { LiveTrace } from '@/features/run/ui/LiveTrace';
import { formatDistance, formatDuration, formatPace } from '@/shared/lib/format';
import { colors, radius, spacing } from '@/shared/theme';
import { Body, Button, Display, Heading, Label, ProgressRing, Small, Stat } from '@/shared/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RunSession'>;
type SessionRoute = RouteProp<RootStackParamList, 'RunSession'>;

/** Écart d'allure toléré avant de signaler qu'on est hors cible (s/km). */
const PACE_TOLERANCE_S = 12;

export function RunSessionScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<SessionRoute>();
  // L'écran de course garde l'écran allumé : c'est le seul endroit de l'app
  // où on regarde le téléphone sans le toucher.
  useKeepAwake();

  const settings = usePlanStore((state) => state.settings);
  const workouts = usePlanStore((state) => state.workouts);
  const addActivity = usePlanStore((state) => state.addActivity);

  const run = useRunStore();
  const workout = params?.workoutId
    ? workouts.find((candidate) => candidate.id === params.workoutId) ?? null
    : null;

  // Préparation au montage seulement : `prepare` réinitialise le moteur, le
  // rejouer pendant la séance effacerait ce qui a déjà été couru.
  useEffect(() => {
    run.prepare(workout, settings);
    // Le GPS s'allume tout de suite, avant même le départ : il lui faut
    // quelques dizaines de secondes pour passer d'une position à 50 m à une
    // position à 5 m, et autant qu'il les prenne pendant qu'on s'échauffe.
    void run.warmUp();
    return () => {
      // Quitter l'écran sans avoir démarré doit éteindre le capteur : le
      // préchauffage ne doit pas continuer à consommer en arrière-plan parce
      // qu'on a simplement regardé la séance du jour. Lu depuis le magasin et
      // non depuis la fermeture, qui capturerait un état périmé.
      if (useRunStore.getState().status === 'idle') useRunStore.getState().reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enregistrement dès que la séance se termine — que la fin vienne du bouton
  // ou de la dernière étape franchie.
  useEffect(() => {
    if (run.status !== 'finished' || !run.lastActivity) return;
    const activity = run.lastActivity;
    addActivity(activity);
    run.reset();
    navigation.replace('RunSummary', { activityId: activity.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.status, run.lastActivity]);

  const step = currentStep(run);
  const upcoming = nextStep(run);
  const zone = step ? findZone(settings.zones, step.zoneId) : undefined;
  const accent = zone?.color ?? colors.accent;

  const remaining = step ? stepRemaining(step, run.engine) : null;
  const progress = step ? stepProgress(step, run.engine) : 0;

  // Couleur de l'indicateur GPS : verte quand le filtre a de quoi mesurer,
  // ambre pendant le calage, grise tant qu'aucune position n'est arrivée.
  const gpsColor =
    run.accuracyM == null
      ? colors.textFaint
      : run.gpsReady && run.accuracyM <= 12
        ? colors.success
        : colors.warning;

  // Couleur de l'allure en direct. Calculée à chaque rendu, sans mémoïsation :
  // c'est une comparaison de deux nombres, et l'écran se redessine de toute
  // façon quatre fois par seconde.
  const paceColor = (() => {
    if (!step || run.currentPaceSecPerKm <= 0 || step.targetPaceSecPerKm <= 0) return colors.text;
    const delta = run.currentPaceSecPerKm - step.targetPaceSecPerKm;
    if (Math.abs(delta) <= PACE_TOLERANCE_S) return colors.success;
    // Trop lent (allure plus élevée) en ambre, trop rapide en bleu.
    return delta > 0 ? colors.warning : colors.info;
  })();

  const confirmQuit = () => {
    Alert.alert('Quitter la séance', 'La séance en cours ne sera pas enregistrée.', [
      { text: 'Continuer à courir', style: 'cancel' },
      {
        text: 'Abandonner',
        style: 'destructive',
        onPress: () => {
          run.reset();
          navigation.goBack();
        },
      },
    ]);
  };

  const confirmFinish = () => {
    Alert.alert('Terminer la séance', 'L’effort sera enregistré avec son tracé.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Terminer', onPress: () => run.finish() },
    ]);
  };

  if (run.status === 'countdown') {
    return (
      <SafeAreaView style={styles.countdownScreen}>
        <Label>{run.workoutName}</Label>
        <Display color={colors.accent} style={styles.countdownNumber}>
          {Math.max(1, Math.ceil(run.countdownLeft))}
        </Display>
        <Button label="Annuler" variant="ghost" onPress={confirmQuit} />
      </SafeAreaView>
    );
  }

  if (run.status === 'idle') {
    return (
      <SafeAreaView style={styles.countdownScreen}>
        <Label>{workout ? 'Séance prête' : 'Prêt à partir'}</Label>
        <Heading style={styles.readyTitle}>{run.workoutName}</Heading>
        {run.error ? <Body style={styles.error}>{run.error}</Body> : null}
        <Small style={styles.readyHint}>
          {run.steps.length > 0
            ? `${run.steps.length} étapes · repères sonores ${settings.voiceEnabled ? 'et voix ' : ''}activés`
            : 'Distance, allure et tracé seront enregistrés.'}
        </Small>

        {/* État du signal AVANT le départ : partir avec un GPS encore froid
            fausse les premières centaines de mètres, et c'est la seule chose
            qu'on ne peut plus corriger après coup. */}
        <View style={styles.gpsReady}>
          <Satellite size={14} color={gpsColor} />
          <Small style={{ color: gpsColor }}>
            {run.accuracyM == null
              ? 'Recherche du signal GPS…'
              : run.gpsReady
                ? `Signal GPS prêt · ± ${Math.round(run.accuracyM)} m`
                : `Signal en cours de calage · ± ${Math.round(run.accuracyM)} m`}
          </Small>
        </View>
        <View style={styles.readyActions}>
          <Button
            label="Démarrer"
            size="lg"
            icon={<Play size={18} color={colors.accentInk} fill={colors.accentInk} />}
            onPress={() => run.start(settings)}
          />
          <Button label="Retour" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={confirmQuit} hitSlop={10} accessibilityRole="button">
          <Small style={styles.quit}>Quitter</Small>
        </Pressable>
        <View style={styles.gps}>
          <Satellite size={14} color={gpsColor} />
          <Small>
            {run.accuracyM == null
              ? 'GPS…'
              : run.gpsReady
                ? `± ${Math.round(run.accuracyM)} m`
                : 'calage…'}
          </Small>
        </View>
        <Small>
          {run.steps.length > 0 ? `${run.engine.stepIndex + 1}/${run.steps.length}` : 'Libre'}
        </Small>
      </View>

      <View style={styles.center}>
        {step && remaining ? (
          <View style={styles.ringWrap}>
            <ProgressRing progress={progress} size={272} stroke={12} color={accent} />
            <View style={styles.ringContent}>
              <Label color={accent}>{step.label}</Label>
              <Display>
                {remaining.type === 'time'
                  ? formatDuration(remaining.seconds)
                  : Math.round(remaining.meters)}
              </Display>
              <Small style={styles.ringUnit}>
                {remaining.type === 'time' ? 'restant' : 'mètres restants'}
              </Small>
              {/* Pas de cible d'allure sur une étape marchée : on marche, on
                  ne vise pas un chrono au kilomètre. */}
              {step.kind !== 'walk' && step.targetPaceSecPerKm > 0 ? (
                <Body style={[styles.target, { color: accent }]}>
                  cible {formatPace(step.targetPaceSecPerKm)} /km
                </Body>
              ) : null}
            </View>
          </View>
        ) : (
          // Sortie libre : pas d'étape à suivre, donc la place va au chrono et
          // au parcours — les deux seules choses qu'on regarde en courant sans
          // plan.
          <View style={styles.freeRun}>
            <Label style={styles.centered}>Temps</Label>
            <Display style={styles.centered}>{formatDuration(run.engine.elapsedS)}</Display>
            <View style={styles.freeRunMap}>
              <LiveTrace height={260} />
            </View>
          </View>
        )}
      </View>

      <View style={styles.metrics}>
        <Stat
          align="center"
          color={paceColor}
          value={run.currentPaceSecPerKm > 0 ? formatPace(run.currentPaceSecPerKm) : '—'}
          label="Allure"
        />
        <Stat
          align="center"
          value={formatDistance(run.engine.distanceM, { forceKm: true }).replace(' km', '')}
          label="Km"
        />
        <Stat align="center" value={formatDuration(run.engine.elapsedS)} label="Temps" />
      </View>

      {upcoming ? (
        <View style={styles.next}>
          <ChevronRight size={14} color={colors.textFaint} />
          <Small numberOfLines={1}>
            Puis {upcoming.label.toLowerCase()} ·{' '}
            {upcoming.target.type === 'time'
              ? formatDuration(upcoming.target.seconds)
              : formatDistance(upcoming.target.meters)}
          </Small>
        </View>
      ) : null}

      <View style={styles.controls}>
        {run.status === 'paused' ? (
          <Button
            label="Reprendre"
            size="lg"
            icon={<Play size={18} color={colors.accentInk} fill={colors.accentInk} />}
            onPress={run.resume}
          />
        ) : (
          <Button
            label="Pause"
            size="lg"
            variant="secondary"
            icon={<Pause size={18} color={colors.text} />}
            onPress={run.pause}
          />
        )}

        {run.steps.length > 0 ? (
          <Button
            label="Suivant"
            size="lg"
            variant="secondary"
            icon={<ChevronRight size={18} color={colors.text} />}
            onPress={() => run.skip(settings)}
          />
        ) : null}

        <Button
          label="Terminer"
          size="lg"
          variant="danger"
          icon={<Square size={16} color={colors.danger} fill={colors.danger} />}
          onPress={confirmFinish}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  countdownScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  countdownNumber: { fontSize: 128, lineHeight: 140 },
  readyTitle: { textAlign: 'center' },
  readyHint: { textAlign: 'center', maxWidth: 300 },
  gpsReady: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  readyActions: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  error: { color: colors.danger, textAlign: 'center', maxWidth: 320 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  quit: { color: colors.textMuted },
  gps: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringUnit: { marginTop: -spacing.xs },
  target: { fontWeight: '700', marginTop: spacing.sm },
  freeRun: { alignItems: 'stretch', gap: spacing.xs, width: '100%' },
  freeRunMap: { paddingTop: spacing.xl },
  centered: { textAlign: 'center' },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
});
