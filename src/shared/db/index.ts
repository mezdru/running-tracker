// Base locale SQLite. L'app est mono-utilisateur et hors ligne par nature —
// on court sans réseau —, donc toutes les données vivent sur l'appareil : pas
// de serveur, pas de compte, pas de synchronisation à réconcilier. C'est le
// choix qui rend la pipeline aussi courte (un build, une soumission) et qui
// garantit qu'une séance démarre même en montagne sans couverture.
//
// L'API SYNCHRONE est utilisée volontairement. Les volumes sont minuscules
// (quelques centaines de séances, quelques dizaines d'activités) et travailler
// en synchrone supprime toute une classe de bugs d'ordonnancement au démarrage,
// là où l'app doit afficher le calendrier immédiatement.
import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';

let database: SQLite.SQLiteDatabase | null = null;

export function db(): SQLite.SQLiteDatabase {
  if (!database) {
    database = SQLite.openDatabaseSync('allure.db');
    // WAL : indispensable ici, l'écriture des points GPS pendant une séance ne
    // doit jamais bloquer une lecture de l'interface.
    database.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    runMigrations(database);
  }
  return database;
}

/** Encapsule un lot d'écritures : tout passe, ou rien (copie de semaine). */
export function transaction(fn: () => void): void {
  db().withTransactionSync(fn);
}
