// Réception des positions en arrière-plan.
//
// iOS livre les positions accumulées en réveillant l'app SANS INTERFACE : la
// tâche doit donc être déclarée au chargement du bundle (cf. index.ts) et pas
// depuis un composant, qui n'existe pas à cet instant. Elle se contente de
// pousser les points vers l'abonné en cours — le magasin de séance quand
// l'écran de course est monté — ou de les mettre en attente sinon.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import type { TrackPoint } from '@/shared/lib/geo';

export const LOCATION_TASK = 'allure-location-updates';

type Handler = (points: TrackPoint[]) => void;

let handler: Handler | null = null;
/** Points reçus alors qu'aucun écran n'était monté pour les consommer. */
let pending: TrackPoint[] = [];

export function toTrackPoint(location: Location.LocationObject): TrackPoint {
  return {
    t: location.timestamp,
    lat: location.coords.latitude,
    lon: location.coords.longitude,
    alt: location.coords.altitude,
    // Une précision absente vaut « inconnue », pas « parfaite » : on prend une
    // valeur haute pour que le filtrage la traite avec méfiance.
    acc: location.coords.accuracy ?? 99,
    spd: location.coords.speed,
    // Cap et précision verticale : iOS les rend négatifs quand ils ne sont pas
    // exploitables, le filtre s'en sert pour décider s'il peut y croire.
    course: location.coords.heading,
    altAcc: location.coords.altitudeAccuracy,
  };
}

export function setLocationHandler(next: Handler | null): void {
  handler = next;
  if (next && pending.length > 0) {
    next(pending);
    pending = [];
  }
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations?.length) return;
  const points = locations.map(toTrackPoint);
  if (handler) handler(points);
  // Plafonné : si l'app est réveillée sans écran pendant très longtemps, la
  // file ne doit pas grossir sans limite en mémoire.
  else pending = [...pending, ...points].slice(-5000);
});
