import { DEFAULT_ZONES } from '@/entities/pace/model';
import { db } from '@/shared/db';

import { DEFAULT_SETTINGS, ZONES_VERSION, type Settings } from './model';

/**
 * Relit les réglages clé par clé et retombe sur les valeurs par défaut pour
 * tout ce qui manque ou ne se relit pas. Une clé corrompue ne doit jamais
 * empêcher l'app de démarrer : au pire, un réglage revient à son défaut.
 */
export function loadSettings(): Settings {
  const rows = db().getAllSync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const settings = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const raw = stored.get(key);
    if (raw === undefined) continue;
    try {
      // `as never` : la clé garantit déjà le type de la valeur ; TypeScript ne
      // peut pas le prouver sur une affectation indexée par une union.
      settings[key] = JSON.parse(raw) as never;
    } catch {
      // valeur illisible : on garde le défaut déjà en place
    }
  }

  return migrateZones(settings, stored);
}

/**
 * Réinsère les zones intégrées apparues après l'installation.
 *
 * Le cas concret : une base créée avant l'ajout de la marche contient ses sept
 * zones et rien d'autre, si bien que les modèles qui référencent la marche
 * tomberaient sur une allure inexistante. On ne le fait qu'UNE fois, en
 * mémorisant la version : sans cela, une zone volontairement supprimée
 * reviendrait à chaque démarrage.
 */
function migrateZones(settings: Settings, stored: Map<string, string>): Settings {
  // Aucune ligne `zones` : installation neuve, les défauts sont déjà à jour.
  // Ligne présente mais sans version : base d'avant l'introduction du compteur.
  const version = stored.has('zonesVersion')
    ? settings.zonesVersion
    : stored.has('zones')
      ? 1
      : ZONES_VERSION;
  if (version >= ZONES_VERSION) return { ...settings, zonesVersion: ZONES_VERSION };

  const known = new Set(settings.zones.map((zone) => zone.id));
  const zones = [...settings.zones];
  // Chaque manquante est réinsérée à SON rang dans les défauts, pour que
  // l'ordre reste une progression d'intensité.
  DEFAULT_ZONES.forEach((zone, index) => {
    if (known.has(zone.id)) return;
    zones.splice(Math.min(index, zones.length), 0, zone);
  });

  return { ...settings, zones, zonesVersion: ZONES_VERSION };
}

/**
 * Écrit les réglages SANS ouvrir de transaction.
 *
 * SQLite n'imbrique pas les transactions : un `BEGIN` à l'intérieur d'un autre
 * termine le premier, et la validation extérieure échoue ensuite sur un
 * « cannot rollback - no transaction is active ». C'est arrivé à la
 * restauration de sauvegarde, qui écrit les réglages au milieu de sa propre
 * transaction — d'où cette version nue, réservée aux appelants qui en ont
 * déjà ouvert une.
 */
export function writeSettings(settings: Settings): void {
  const database = db();
  for (const [key, value] of Object.entries(settings)) {
    database.runSync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, JSON.stringify(value)],
    );
  }
}

export function saveSettings(settings: Settings): void {
  db().withTransactionSync(() => writeSettings(settings));
}
