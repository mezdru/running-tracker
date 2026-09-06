// Retours sonores de la séance. C'est la raison d'être de l'écran de course :
// on doit pouvoir suivre un fractionné SANS regarder le téléphone, à l'oreille
// seule. Deux registres complémentaires — des bips pour ce qui doit être
// instantané (décompte, changement d'étape) et la voix pour ce qui porte une
// information (« Intervalle 3 sur 8, 400 mètres à 3 minutes 45 »).
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

import { spokenDistance, spokenDuration, spokenPace } from '@/shared/lib/format';

import type { RunEvent } from './engine';

type CueName = 'tick' | 'step' | 'finish';

const SOURCES: Record<CueName, number> = {
  tick: require('../../../assets/audio/beep-tick.wav'),
  step: require('../../../assets/audio/beep-step.wav'),
  finish: require('../../../assets/audio/beep-finish.wav'),
};

// Les lecteurs sont créés une fois et RÉUTILISÉS : instancier un lecteur à
// chaque bip ajoute un délai de décodage de quelques dizaines de millisecondes,
// ce qui suffit à décaler un décompte de trois secondes.
const players: Partial<Record<CueName, AudioPlayer>> = {};

let prepared = false;

/**
 * Prépare la session audio. Appelé au démarrage d'une séance, pas au montage
 * de l'app : c'est ce qui décide que les bips passent en mode silencieux et
 * continuent écran verrouillé, et il n'y a aucune raison de réquisitionner la
 * session audio du téléphone tant qu'on ne court pas.
 */
export async function prepareAudio(): Promise<void> {
  if (prepared) return;
  prepared = true;
  try {
    await setAudioModeAsync({
      // Un coureur laisse souvent le téléphone en silencieux : sans ceci, tous
      // les repères sonores de la séance seraient muets sans qu'on comprenne
      // pourquoi.
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // La musique baisse le temps de l'annonce au lieu de s'arrêter.
      interruptionMode: 'duckOthers',
    });
    for (const name of Object.keys(SOURCES) as CueName[]) {
      players[name] = createAudioPlayer(SOURCES[name]);
    }
  } catch {
    // Pas de son disponible (simulateur, session refusée) : la séance se
    // déroule normalement, en silence.
  }
}

export function releaseAudio(): void {
  for (const name of Object.keys(players) as CueName[]) {
    try {
      players[name]?.release();
    } catch {
      // lecteur déjà libéré
    }
    delete players[name];
  }
  prepared = false;
}

function beep(name: CueName): void {
  const player = players[name];
  if (!player) return;
  try {
    // Rembobiner avant de jouer : trois bips de décompte se suivent de moins
    // d'une seconde, et un lecteur laissé en fin de piste ne rejouerait rien.
    player.seekTo(0);
    player.play();
  } catch {
    // idem : le son est un confort, jamais un prérequis
  }
}

/**
 * Vibration au changement d'étape. Complète le son plutôt que de le doubler :
 * casque anti-bruit, vent de face ou musique forte, le bip peut passer
 * inaperçu — la vibration dans la poche, non.
 */
function buzz(style: 'step' | 'finish'): void {
  try {
    if (style === 'finish') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // moteur haptique indisponible (simulateur)
  }
}

function say(text: string): void {
  try {
    Speech.speak(text, { language: 'fr-FR', rate: 1.0, pitch: 1.0 });
  } catch {
    // synthèse indisponible
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // rien à interrompre
  }
}

export type CueSettings = { voiceEnabled: boolean; beepsEnabled: boolean };

/** Phrase annonçant une étape : son nom, sa cible, son allure. */
export function describeStep(step: {
  label: string;
  target: { type: 'time'; seconds: number } | { type: 'distance'; meters: number };
  targetPaceSecPerKm: number;
}): string {
  const cible =
    step.target.type === 'time'
      ? spokenDuration(step.target.seconds)
      : spokenDistance(step.target.meters);
  // « 3/8 » se lirait « trois huitièmes » : la synthèse a besoin du mot.
  const label = step.label.replace(/(\d+)\/(\d+)/, '$1 sur $2');
  const pace = step.targetPaceSecPerKm > 0 ? ` à ${spokenPace(step.targetPaceSecPerKm)}` : '';
  return `${label}. ${cible}${pace}.`;
}

/**
 * Traduit les évènements du moteur en sons. Un seul point d'entrée, pour que
 * l'écran de course n'ait aucune logique sonore : il joue les évènements qu'on
 * lui donne, dans l'ordre.
 */
export function playCues(events: RunEvent[], settings: CueSettings): void {
  for (const event of events) {
    switch (event.type) {
      case 'countdown':
        if (settings.beepsEnabled) beep('tick');
        break;
      case 'approach':
        if (settings.beepsEnabled) beep('tick');
        break;
      case 'step-start':
        buzz('step');
        if (settings.beepsEnabled) beep('step');
        if (settings.voiceEnabled) say(describeStep(event.step));
        break;
      case 'split':
        if (settings.voiceEnabled) {
          const km = event.split.index;
          say(
            `${km} ${km === 1 ? 'kilomètre' : 'kilomètres'}. ${spokenDuration(event.split.durationS)}.`,
          );
        }
        break;
      case 'finish':
        buzz('finish');
        if (settings.beepsEnabled) beep('finish');
        if (settings.voiceEnabled) say('Séance terminée.');
        break;
      case 'step-end':
        // Rien : la fin d'une étape est toujours suivie soit d'un `step-start`,
        // soit d'un `finish`, qui portent déjà l'annonce.
        break;
    }
  }
}

/** Annonce le décompte avant le départ (« 3, 2, 1, partez »). */
export function countdownCue(secondsLeft: number, settings: CueSettings): void {
  if (settings.beepsEnabled) beep(secondsLeft === 0 ? 'step' : 'tick');
  if (settings.voiceEnabled && secondsLeft === 0) say('C’est parti.');
}
