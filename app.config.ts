// Configuration Expo. En TypeScript et non en JSON parce que la version
// marketing est réécrite par la pipeline de release (voir
// .github/workflows/release-ios.yml, qui remplace la ligne `version:`) et
// qu'un fichier de config typé casse tout de suite si une clé est mal nommée.
//
// L'app est mono-plateforme iOS assumé : la section `android` n'est pas
// entretenue et aucun build Android n'est produit par la pipeline.
import type { ExpoConfig } from 'expo/config';

// Project ID EAS. Ce n'est PAS un secret — il figure dans l'URL du projet sur
// expo.dev et dans le bundle —, mais eas-cli résout le projet par cette valeur :
// sans elle, aucune commande `eas` ne fonctionne en mode non interactif.
//
// Deux façons de le fournir, au choix :
//   1. le coller ci-dessous après `eas init` (le plus simple, et c'est ce que
//      fait le workflow de release s'il ne trouve rien dans l'environnement) ;
//   2. le passer par EAS_PROJECT_ID — variable de dépôt GitHub `EAS_PROJECT_ID`,
//      que .github/workflows/release-ios.yml injecte déjà.
//
// Renseigné : projet expo.dev/accounts/mezdru/projects/running-tracker.
const EAS_PROJECT_ID = 'f39e047e-81da-44cb-b2a4-cc4ec4830179';

const easProjectId = process.env.EAS_PROJECT_ID || EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'Running Tracker for the BOT',
  // Doit correspondre au projet EAS (expo.dev/accounts/mezdru/projects/…) :
  // eas-cli refuse de publier si le slug diverge de celui du projet.
  slug: 'running-tracker',
  version: '1.2.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'allure',
  // L'interface est dessinée en sombre uniquement (écran de course lisible en
  // plein soleil, contraste maximal). On le déclare pour que les composants
  // natifs — barres système, feuilles modales — s'accordent au lieu de
  // clignoter en clair au montage.
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B0D10',
  ios: {
    bundleIdentifier: 'com.mezdru.runningtracker',
    supportsTablet: false,
    infoPlist: {
      // `location` : la trace GPS doit continuer écran verrouillé, c'est le cas
      // d'usage normal (téléphone en brassard ou en poche pendant la séance).
      // `audio` : sans ce mode, la voix et les bips qui annoncent les
      // intervalles sont coupés dès que l'écran s'éteint — ce qui vide de son
      // sens l'idée même de suivre la séance à l'oreille.
      UIBackgroundModes: ['location', 'audio'],
      // Les cadrans de course affichent des grands nombres : on interdit
      // l'agrandissement système du texte, qui casserait la mise en page des
      // chronos au milieu d'une séance.
      ITSAppUsesNonExemptEncryption: false,
      // Sans cette déclaration, iOS refuse `canOpenURL('strava://')` et l'app
      // ne peut pas savoir si Strava est installé — donc pas adapter la marche
      // à suivre affichée.
      LSApplicationQueriesSchemes: ['strava'],
    },
  },
  android: {
    package: 'com.mezdru.runningtracker',
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-sqlite',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Votre position sert à mesurer la distance, l’allure et le tracé de vos séances.',
        locationAlwaysAndWhenInUsePermission:
          'Le parcours continue d’être enregistré écran verrouillé, pour ne pas interrompre la séance en cours.',
        // Ajoute le mode de fond `location` côté natif et le drapeau qui
        // autorise `startLocationUpdatesAsync`. Sans lui, la trace s'arrête
        // net au verrouillage de l'écran.
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    [
      'expo-audio',
      {
        // On ne fait que jouer des bips : sans ce `false`, le plugin ajoute
        // NSMicrophoneUsageDescription et l'App Store demande de justifier un
        // accès micro que l'app n'utilise jamais.
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#0B0D10',
      },
    ],
    'expo-sharing',
    [
      'expo-build-properties',
      {
        // Cible minimale du SDK 57 (expo-build-properties refuse en dessous
        // de 16.4). Épinglée pour que le build local et le build EAS partagent
        // la même cible et échouent au même endroit en cas de dérive.
        ios: { deploymentTarget: '16.4' },
      },
    ],
  ],
  extra: easProjectId ? { eas: { projectId: easProjectId } } : undefined,
};

export default config;
