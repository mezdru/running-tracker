// Envoi d'une sortie vers Strava.
//
// Il n'y a PAS de synchronisation automatique, et ce n'est pas un oubli :
// l'API Strava impose un échange OAuth, donc un secret client qui ne peut pas
// vivre dans l'app — il faudrait une brique serveur, c'est-à-dire exactement
// ce que ce projet évite (cf. README). En attendant, le chemin manuel est
// court et fiable : un fichier GPX, et la feuille de partage iOS.
//
// Ce que Strava sait faire aujourd'hui côté iPhone :
//   - importer un fichier depuis l'app (Enregistrer → « + » → Importer) ;
//   - importer depuis le site, sur strava.com/upload/select.
// L'app se contente donc de produire le fichier et de le mettre au bon endroit,
// puis de dire où aller. Elle ne promet pas un import qu'elle n'exécute pas.
import { File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';

import type { Activity } from '@/entities/activity/model';

import { toGpx } from './gpx';

/** Page d'import de Strava, utilisable depuis Safari. */
export const STRAVA_UPLOAD_URL = 'https://www.strava.com/upload/select';

/** Schéma de l'app Strava, déclaré dans LSApplicationQueriesSchemes. */
const STRAVA_SCHEME = 'strava://';

/**
 * L'app Strava est-elle installée ? Détermine seulement le TEXTE affiché : le
 * partage fonctionne dans les deux cas, mais la marche à suivre n'est pas la
 * même selon qu'on a l'app ou non.
 */
export async function isStravaInstalled(): Promise<boolean> {
  try {
    return await Linking.canOpenURL(STRAVA_SCHEME);
  } catch {
    // iOS refuse la requête si le schéma n'est pas déclaré : on ne peut pas
    // savoir, et on présente alors la marche à suivre générale.
    return false;
  }
}

export async function openStravaApp(): Promise<void> {
  await Linking.openURL(STRAVA_SCHEME);
}

export async function openStravaUpload(): Promise<void> {
  await Linking.openURL(STRAVA_UPLOAD_URL);
}

/**
 * Prépare le GPX et ouvre la feuille de partage.
 *
 * Le fichier va dans le cache : sa copie durable, c'est l'activité en base.
 * Le nom porte la date et le nom de la séance — dans la liste d'import de
 * Strava, on doit pouvoir reconnaître le bon fichier sans l'ouvrir.
 */
export async function shareForStrava(activity: Activity, name: string): Promise<void> {
  if (activity.track.length < 2) {
    throw new Error(
      'Cette sortie n’a pas de tracé GPS : Strava ne peut pas l’importer en GPX.',
    );
  }

  const safeName = name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'sortie';
  const date = new Date(activity.startedAt).toISOString().slice(0, 10);
  const file = new File(Paths.cache, `${date}-${safeName}.gpx`);
  if (file.exists) file.delete();
  file.create();
  file.write(toGpx(activity, name));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Le partage de fichiers n’est pas disponible sur cet appareil.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/gpx+xml',
    dialogTitle: 'Envoyer à Strava',
    // L'UTI officiel du format : c'est lui qui décide quelles apps
    // apparaissent dans la feuille de partage.
    UTI: 'com.topografix.gpx',
  });
}
