import { db } from '@/shared/db';

import { DEFAULT_SETTINGS, type Settings } from './model';

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
  return settings;
}

export function saveSettings(settings: Settings): void {
  const database = db();
  database.withTransactionSync(() => {
    for (const [key, value] of Object.entries(settings)) {
      database.runSync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, JSON.stringify(value)],
      );
    }
  });
}
