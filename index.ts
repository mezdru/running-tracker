import { registerRootComponent } from 'expo';

import App from './src/app/App';

// Enregistre la tâche de localisation en arrière-plan au chargement du bundle,
// et non depuis un composant : iOS réveille l'app SANS INTERFACE pour livrer
// les positions accumulées pendant que l'écran était verrouillé. À ce
// moment-là aucun écran n'est monté, donc plus rien ne pourrait l'enregistrer.
import './src/features/run/background-task';

registerRootComponent(App);
