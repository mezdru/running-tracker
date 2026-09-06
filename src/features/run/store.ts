// Orchestration d'une séance en cours. Le magasin fait le lien entre trois
// choses volontairement séparées : le moteur (pur, testé), le capteur GPS et
// les repères sonores. Lui seul connaît le temps qui passe.
//
// Point de conception important : le chrono ne compte pas les ticks, il lit
// l'horloge. Un `setInterval` de 1 s n'est jamais exact, et iOS le ralentit
// franchement quand l'écran s'éteint — compter les ticks ferait perdre des
// minutes sur une sortie longue. On mesure donc l'écart réel entre deux
// réveils, et le moteur absorbe des ticks de durée quelconque.
import { create } from 'zustand';

import type { Activity } from '@/entities/activity/model';
import { paceTable } from '@/entities/pace/model';
import type { Settings } from '@/entities/settings/model';
import { flattenBlocks } from '@/entities/workout/estimate';
import type { Workout } from '@/entities/workout/model';
import { elevationGain, type TrackPoint } from '@/shared/lib/geo';
import { newId } from '@/shared/lib/id';

import { setLocationHandler, toTrackPoint } from './background-task';
import { createFilter, ingestPoint, type FilterState } from './gps-filter';
import { countdownCue, playCues, prepareAudio, releaseAudio, stopSpeaking } from './cues';
import {
  advance,
  initialState,
  skipStep,
  type EngineState,
  type EngineStep,
} from './engine';
import {
  hasForegroundPermission,
  requestPermissions,
  startTracking,
  stopTracking,
  watchForeground,
} from './gps';

export type RunStatus = 'idle' | 'countdown' | 'running' | 'paused' | 'finished';

type RunState = {
  status: RunStatus;
  workoutId: string | null;
  workoutName: string;
  steps: EngineStep[];
  engine: EngineState;
  track: TrackPoint[];
  startedAt: number | null;
  countdownLeft: number;
  /** Allure instantanée lissée, en s/km — 0 tant qu'elle n'est pas fiable. */
  currentPaceSecPerKm: number;
  /** Précision GPS du dernier point, en mètres (`null` avant le premier). */
  accuracyM: number | null;
  /**
   * Le GPS a-t-il une position assez fiable pour mesurer ? Faux pendant les
   * premières secondes d'un démarrage à froid — et c'est affiché, pour qu'on
   * puisse attendre le signal au lieu de partir avec une trace fausse.
   */
  gpsReady: boolean;
  /** Message d'erreur bloquant (permission refusée, capteur indisponible). */
  error: string | null;
  /** Séance enregistrée à l'arrêt, consommée par l'écran de résumé. */
  lastActivity: Activity | null;

  prepare: (workout: Workout | null, settings: Settings) => void;
  /** Allume le capteur avant le départ, si l'autorisation est déjà accordée. */
  warmUp: () => Promise<void>;
  start: (settings: Settings) => Promise<void>;
  pause: () => void;
  resume: () => void;
  skip: (settings: Settings) => void;
  finish: () => Activity | null;
  reset: () => void;
};

// Ressources hors état React : elles n'ont pas à provoquer de rendu et ne
// doivent surtout pas être recréées par une mise à jour du magasin.
let ticker: ReturnType<typeof setInterval> | null = null;
let lastTickAt = 0;
let pendingDistanceM = 0;
let filter: FilterState = createFilter();
/** Vrai quand le capteur tourne déjà, avant même le départ (préchauffage). */
let sensorRunning = false;
let foregroundWatch: { remove: () => void } | null = null;
let liveSettings: Settings | null = null;

/**
 * Allure instantanée affichée, lissée. La vitesse vient du filtre de Kalman —
 * qui l'estime déjà à partir de la position ET du Doppler — et non d'une
 * fenêtre glissante de distances : la fenêtre réagissait avec vingt secondes
 * de retard, ce qui la rendait inutile sur un 30/30. Il ne reste qu'un léger
 * lissage d'affichage, pour que le chiffre ne saute pas à chaque relevé.
 */
let smoothedSpeed = 0;
const SPEED_DISPLAY_ALPHA = 0.35;
/** En dessous, on n'affiche pas d'allure : ce serait un nombre au hasard. */
const MIN_DISPLAY_SPEED = 0.8;

function clearResources() {
  if (ticker) clearInterval(ticker);
  ticker = null;
  setLocationHandler(null);
  foregroundWatch?.remove();
  foregroundWatch = null;
  void stopTracking();
  sensorRunning = false;
  stopSpeaking();
  releaseAudio();
  pendingDistanceM = 0;
  filter = createFilter();
  smoothedSpeed = 0;
  liveSettings = null;
}

export const useRunStore = create<RunState>((set, get) => {
  /**
   * Intègre un lot de positions. Tout le travail de précision est délégué à
   * `gps-filter` ; ici on ne fait que router le résultat : la trace estimée
   * d'un côté, la distance de l'autre.
   */
  function ingest(points: TrackPoint[]) {
    const { status } = get();
    const accepted: TrackPoint[] = [];
    let gpsReady = get().gpsReady;
    let accuracyM = get().accuracyM;

    for (const point of points) {
      const result = ingestPoint(filter, point);
      if (result.kind !== 'accepted') continue;

      accuracyM = point.acc;
      gpsReady = result.ready;
      smoothedSpeed =
        smoothedSpeed === 0
          ? result.speed
          : smoothedSpeed + SPEED_DISPLAY_ALPHA * (result.speed - smoothedSpeed);

      // Avant le départ, le capteur tourne pour se caler : le filtre se
      // réchauffe, mais rien n'est enregistré.
      if (status === 'idle') continue;
      accepted.push(result.point);
      // En pause, la trace continue d'être enregistrée (elle montre le trajet)
      // mais la distance ne compte pas : c'est le sens d'une pause.
      if (status === 'running') pendingDistanceM += result.distance;
    }

    set({
      gpsReady,
      accuracyM,
      track: accepted.length > 0 ? [...get().track, ...accepted] : get().track,
      // En pause, aucune allure : afficher la dernière connue laisserait
      // croire que le chrono tourne encore.
      currentPaceSecPerKm:
        status !== 'paused' && smoothedSpeed >= MIN_DISPLAY_SPEED
          ? 1000 / smoothedSpeed
          : 0,
    });
  }

  /** Un réveil du chrono : mesure le temps réel écoulé et fait avancer le moteur. */
  function tick() {
    const state = get();
    const settings = liveSettings;
    if (!settings) return;

    const now = Date.now();
    const dtS = Math.max(0, (now - lastTickAt) / 1000);
    lastTickAt = now;

    if (state.status === 'countdown') {
      const countdownLeft = Math.max(0, state.countdownLeft - dtS);
      const previousWhole = Math.ceil(state.countdownLeft);
      const currentWhole = Math.ceil(countdownLeft);
      if (currentWhole < previousWhole) countdownCue(currentWhole, settings);
      if (countdownLeft <= 0) {
        set({ status: 'running', countdownLeft: 0, startedAt: Date.now() });
        // La première étape est annoncée comme les suivantes.
        const first = state.steps[0];
        if (first) playCues([{ type: 'step-start', step: first }], settings);
      } else {
        set({ countdownLeft });
      }
      return;
    }

    if (state.status !== 'running') return;

    const dDistanceM = pendingDistanceM;
    pendingDistanceM = 0;
    // Auto-pause : le temps continue de s'écouler mais ne compte plus comme du
    // mouvement, ce qui préserve l'allure moyenne sans figer le chrono.
    const moving = settings.autoPause ? dDistanceM / Math.max(dtS, 0.001) > 0.5 : true;

    const result = advance(state.engine, state.steps, { dtS, dDistanceM, moving }, {
      splitEveryM: settings.autoLapKm * 1000,
    });
    playCues(result.events, settings);
    set({ engine: result.state });

    if (result.state.finished) {
      // On s'arrête net à la fin du plan : laisser tourner enregistrerait une
      // trace qui continue après le retour au calme.
      get().finish();
    }
  }

  return {
    status: 'idle',
    workoutId: null,
    workoutName: 'Sortie libre',
    steps: [],
    engine: initialState(),
    track: [],
    startedAt: null,
    countdownLeft: 0,
    currentPaceSecPerKm: 0,
    accuracyM: null,
    gpsReady: false,
    error: null,
    lastActivity: null,

    prepare: (workout, settings) => {
      const paces = paceTable(settings.zones, settings.vmaKmh);
      const steps: EngineStep[] = workout
        ? flattenBlocks(workout.blocks).map((step) => ({
            ...step,
            targetPaceSecPerKm: paces[step.zoneId] ?? 0,
          }))
        : [];
      set({
        status: 'idle',
        workoutId: workout?.id ?? null,
        workoutName: workout?.name ?? 'Sortie libre',
        steps,
        engine: initialState(),
        track: [],
        startedAt: null,
        countdownLeft: 0,
        currentPaceSecPerKm: 0,
        accuracyM: null,
        gpsReady: false,
        error: null,
        lastActivity: null,
      });
    },

    /**
     * Préchauffage. Les premières secondes d'un GPS qui s'allume sont les plus
     * mauvaises de toute la séance : positions à 50-100 m, dérive, dizaines de
     * mètres fantômes. Allumer le capteur dès l'ouverture de l'écran de départ
     * laisse au récepteur le temps d'accrocher les satellites PENDANT qu'on
     * range ses affaires, et l'écran affiche quand le signal est bon — de
     * sorte que le chrono ne démarre jamais dans le flou.
     *
     * Ne demande AUCUNE autorisation : si elle n'est pas déjà accordée, on ne
     * fait rien et le premier appui sur « Démarrer » posera la question.
     */
    warmUp: async () => {
      if (sensorRunning || get().status !== 'idle') return;
      if (!(await hasForegroundPermission())) return;
      filter = createFilter();
      smoothedSpeed = 0;
      setLocationHandler(ingest);
      try {
        await startTracking();
        sensorRunning = true;
      } catch {
        try {
          foregroundWatch = await watchForeground((location) => ingest([toTrackPoint(location)]));
          sensorRunning = true;
        } catch {
          // Capteur indisponible : on laissera « Démarrer » réessayer.
        }
      }
    },

    start: async (settings) => {
      if (get().status === 'running' || get().status === 'countdown') return;
      liveSettings = settings;

      const outcome = await requestPermissions();
      if (outcome === 'denied') {
        set({
          error:
            'Sans accès à la position, la distance et le tracé ne peuvent pas être mesurés. Autorisez la localisation dans Réglages > Allure.',
        });
        return;
      }

      await prepareAudio();
      setLocationHandler(ingest);

      // Le capteur tourne peut-être déjà (préchauffage) : dans ce cas on garde
      // le filtre en l'état, c'est tout l'intérêt — il est chaud.
      if (!sensorRunning) {
        if (outcome === 'granted') {
          try {
            await startTracking();
          } catch {
            // Le suivi en arrière-plan a été refusé au dernier moment : on
            // bascule sur le suivi de premier plan plutôt que d'abandonner.
            foregroundWatch = await watchForeground((location) => ingest([toTrackPoint(location)]));
          }
        } else {
          foregroundWatch = await watchForeground((location) => ingest([toTrackPoint(location)]));
        }
        sensorRunning = true;
      }

      lastTickAt = Date.now();
      // La distance accumulée pendant le préchauffage est jetée ; le filtre,
      // lui, est conservé.
      pendingDistanceM = 0;

      const countdownLeft = Math.max(0, settings.countdownS);
      set({
        status: countdownLeft > 0 ? 'countdown' : 'running',
        countdownLeft,
        startedAt: countdownLeft > 0 ? null : Date.now(),
        engine: initialState(),
        error: null,
      });
      if (countdownLeft === 0) {
        const first = get().steps[0];
        if (first) playCues([{ type: 'step-start', step: first }], settings);
      }

      // 250 ms et non 1 s : le décompte de fin d'étape doit tomber à la bonne
      // seconde, et un réveil par seconde le décalerait jusqu'à une seconde
      // entière. Le moteur, lui, est insensible à la fréquence.
      ticker = setInterval(tick, 250);
    },

    pause: () => {
      if (get().status !== 'running') return;
      stopSpeaking();
      set({ status: 'paused', currentPaceSecPerKm: 0 });
    },

    resume: () => {
      if (get().status !== 'paused') return;
      // L'horloge est resynchronisée : sans cela, le premier tick après la
      // reprise verserait toute la durée de la pause dans l'étape en cours.
      lastTickAt = Date.now();
      pendingDistanceM = 0;
      set({ status: 'running' });
    },

    skip: (settings) => {
      const state = get();
      if (state.status !== 'running' && state.status !== 'paused') return;
      const result = skipStep(state.engine, state.steps);
      playCues(result.events, settings);
      set({ engine: result.state });
      if (result.state.finished) get().finish();
    },

    finish: () => {
      const state = get();
      if (state.status === 'idle' || state.status === 'finished') return null;

      const startedAt = state.startedAt ?? Date.now();
      const track = state.track;
      const activity: Activity = {
        id: newId('act'),
        workoutId: state.workoutId,
        startedAt,
        endedAt: Date.now(),
        distanceM: state.engine.distanceM,
        durationS: state.engine.elapsedS,
        // Sans auto-pause, tout le temps est du temps en mouvement : le moteur
        // l'a déjà compté ainsi, on ne recalcule rien ici.
        movingS: state.engine.movingS,
        elevGainM: elevationGain(track),
        track,
        splits: state.engine.splits,
        laps: state.engine.laps,
        stravaActivityId: null,
        stravaSharedAt: null,
        createdAt: Date.now(),
      };

      clearResources();
      set({ status: 'finished', lastActivity: activity });
      return activity;
    },

    reset: () => {
      clearResources();
      set({
        status: 'idle',
        workoutId: null,
        workoutName: 'Sortie libre',
        steps: [],
        engine: initialState(),
        track: [],
        startedAt: null,
        countdownLeft: 0,
        currentPaceSecPerKm: 0,
        accuracyM: null,
        gpsReady: false,
        error: null,
        lastActivity: null,
      });
    },
  };
});

/** Étape en cours, ou `null` en sortie libre / séance terminée. */
export function currentStep(state: Pick<RunState, 'steps' | 'engine'>): EngineStep | null {
  return state.steps[state.engine.stepIndex] ?? null;
}

export function nextStep(state: Pick<RunState, 'steps' | 'engine'>): EngineStep | null {
  return state.steps[state.engine.stepIndex + 1] ?? null;
}
