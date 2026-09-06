// Migrations du schéma, pilotées par `PRAGMA user_version`. Une migration ne
// se modifie JAMAIS après coup : sur un appareil déjà à jour, une correction
// apportée à une migration passée n'est jamais rejouée, et le schéma diverge
// alors silencieusement d'un appareil à l'autre. On en ajoute une nouvelle.
import type { SQLiteDatabase } from 'expo-sqlite';

const MIGRATIONS: ((db: SQLiteDatabase) => void)[] = [
  // v1 — schéma initial.
  (db) => {
    db.execSync(`
      CREATE TABLE workouts (
        id TEXT PRIMARY KEY NOT NULL,
        date TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        blocks TEXT NOT NULL,
        est_distance_m REAL NOT NULL DEFAULT 0,
        est_duration_s REAL NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        done INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Le calendrier et les totaux de semaine interrogent toujours par plage
      -- de dates : sans cet index, chaque changement de mois relit la table.
      CREATE INDEX idx_workouts_date ON workouts (date);

      CREATE TABLE activities (
        id TEXT PRIMARY KEY NOT NULL,
        workout_id TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        distance_m REAL NOT NULL,
        duration_s REAL NOT NULL,
        moving_s REAL NOT NULL,
        elev_gain_m REAL NOT NULL DEFAULT 0,
        track TEXT NOT NULL,
        splits TEXT NOT NULL,
        laps TEXT NOT NULL,
        -- Réservé à la synchronisation Strava, encore à faire : la colonne
        -- existe dès maintenant pour ne pas avoir à migrer une base qui
        -- contiendra déjà des activités le jour où on la branche.
        strava_activity_id TEXT,
        created_at INTEGER NOT NULL,
        -- Une séance supprimée ne doit pas emporter l'effort réellement
        -- couru : le lien est simplement dénoué.
        FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE SET NULL
      );

      CREATE INDEX idx_activities_started ON activities (started_at DESC);

      CREATE TABLE templates (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        blocks TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  },

  // v2 — plans d'entraînement. Les séances ne portent PAS de `plan_id` : un
  // plan couvre une plage de dates, et l'appartenance s'en déduit. Cela évite
  // qu'une séance déplacée hors du plan devienne orpheline, et qu'un plan
  // décalé laisse derrière lui des références mortes.
  (db) => {
    db.execSync(`
      CREATE TABLE plans (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        goal TEXT NOT NULL,
        start_monday TEXT NOT NULL,
        weeks INTEGER NOT NULL,
        race_date TEXT,
        -- Objectifs de volume hebdomadaire, en mètres, sérialisés : un
        -- tableau de N nombres pour N semaines.
        weekly_targets TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX idx_plans_start ON plans (start_monday);
    `);
  },
];

export function runMigrations(db: SQLiteDatabase): void {
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    // Chaque migration est atomique : une erreur en cours de route laisse la
    // base dans son état précédent au lieu d'un schéma à moitié appliqué.
    db.withTransactionSync(() => {
      MIGRATIONS[version](db);
      // `user_version` n'accepte pas de paramètre lié ; la valeur est un entier
      // issu de la boucle, jamais d'une entrée utilisateur.
      db.execSync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
