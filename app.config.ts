// Configuration Expo. En TypeScript et non en JSON parce que la version
// marketing est réécrite par la pipeline de release (voir
// .github/workflows/release-ios.yml, qui remplace la ligne `version:`) et
// qu'un fichier de config typé casse tout de suite si une clé est mal nommée.
//
// L'app est mono-plateforme iOS assumé : la section `android` n'est pas
// entretenue et aucun build Android n'est produit par la pipeline.
import type { ExpoConfig } from 'expo/config';

// Project ID EAS. Volontairement absent du dépôt tant que le projet n'est pas
// créé côté Expo : `eas init` l'écrira ici, ou EAS_PROJECT_ID le fournit depuis
// l'environnement de CI. Ce n'est pas un secret (il figure dans l'URL du projet
// expo.dev), mais un faux ID est pire qu'aucun — eas-cli publierait alors sur
// le mauvais projet.
const easProjectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'Allure',
  slug: 'allure',
  version: '1.0.0',
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
    bundleIdentifier: 'com.mezdru.allure',
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
    },
  },
  android: {
    package: 'com.mezdru.allure',
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-sqlite',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allure utilise votre position pour mesurer la distance, l’allure et le tracé de vos séances.',
        locationAlwaysAndWhenInUsePermission:
          'Allure enregistre votre parcours même écran verrouillé, pour ne pas interrompre la séance en cours.',
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
