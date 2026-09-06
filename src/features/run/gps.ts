// Pilotage du capteur GPS pour une séance. Isolé du magasin pour que celui-ci
// n'ait à connaître ni les permissions, ni le format natif des positions.
import * as Location from 'expo-location';

import { LOCATION_TASK } from './background-task';

export type PermissionOutcome = 'granted' | 'foreground-only' | 'denied';

/**
 * L'autorisation est-elle DÉJÀ accordée ? Lu et non demandé : sert à décider
 * si l'on peut allumer le GPS dès l'ouverture de l'écran de départ, sans faire
 * surgir une boîte de dialogue que personne n'a sollicitée.
 */
export async function hasForegroundPermission(): Promise<boolean> {
  try {
    const status = await Location.getForegroundPermissionsAsync();
    return status.granted;
  } catch {
    return false;
  }
}

/**
 * Demande les autorisations nécessaires.
 *
 * L'autorisation de premier plan suffit à courir ; celle d'arrière-plan n'est
 * demandée qu'ensuite (iOS l'exige dans cet ordre) et son refus est acceptable :
 * la séance fonctionne, la trace s'arrête simplement si l'écran est verrouillé
 * longtemps. On distingue donc les deux cas au lieu d'un booléen.
 */
export async function requestPermissions(): Promise<PermissionOutcome> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return 'denied';
  try {
    const background = await Location.requestBackgroundPermissionsAsync();
    return background.granted ? 'granted' : 'foreground-only';
  } catch {
    return 'foreground-only';
  }
}

/** Réglages du capteur pendant une séance. */
const TRACKING_OPTIONS: Location.LocationTaskOptions = {
  // `BestForNavigation` et pas `High` : sur une piste de 400 m, dix mètres
  // d'erreur, c'est un intervalle qui se termine au mauvais endroit.
  accuracy: Location.Accuracy.BestForNavigation,
  // Une position par seconde environ. `distanceInterval: 0` est délibéré : à
  // l'arrêt entre deux séries, on veut quand même savoir qu'on ne bouge pas,
  // et un intervalle en distance ne livrerait plus rien du tout.
  timeInterval: 1000,
  distanceInterval: 0,
  activityType: Location.ActivityType.Fitness,
  // Sans ceci, iOS suspend les relevés dès qu'il croit l'activité terminée —
  // typiquement pendant une récupération marchée.
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
};

export async function startTracking(): Promise<void> {
  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(
    () => false,
  );
  if (alreadyRunning) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, TRACKING_OPTIONS);
}

/**
 * Arrête le suivi. Ne rejette JAMAIS : l'arrêt est appelé depuis le nettoyage
 * de fin de séance, où plus personne n'attend le résultat, et iOS lève une
 * exception quand la tâche n'était pas enregistrée — cas parfaitement normal
 * si le capteur n'avait jamais démarré, mais qui remonterait alors comme un
 * rejet de promesse non traité en pleine page de résumé.
 */
export async function stopTracking(): Promise<void> {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    // Tâche absente ou déjà arrêtée : il n'y a rien à faire de plus.
  }
}

/**
 * Suivi de repli quand l'autorisation d'arrière-plan a été refusée : la tâche
 * `TaskManager` ne peut alors pas démarrer, mais `watchPositionAsync` suffit
 * tant que l'écran de course est au premier plan.
 */
export async function watchForeground(
  onLocation: (location: Location.LocationObject) => void,
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 0,
    },
    onLocation,
  );
}
