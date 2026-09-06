import { backupFileName, readBackup, type Backup } from './model';

function validBackup(overrides: Partial<Backup> = {}): Backup {
  return {
    format: 'allure-backup',
    version: 1,
    exportedAt: Date.parse('2026-09-06T18:30:00'),
    appVersion: '1.0.0',
    settings: { vmaKmh: 16 } as unknown as Backup['settings'],
    workouts: [{ id: 'w1' }, { id: 'w2' }] as unknown as Backup['workouts'],
    activities: [{ id: 'a1', distanceM: 10000 }] as unknown as Backup['activities'],
    templates: [],
    ...overrides,
  };
}

const raw = (backup: unknown) => JSON.stringify(backup);

describe('readBackup — ce qui est refusé', () => {
  // C'est le cœur de la sécurité : ce fichier décide si l'on écrase, ou non,
  // les seules données que l'utilisateur possède.
  it('refuse un fichier qui n’est pas du JSON', () => {
    const check = readBackup('ceci est un texte');
    expect(check.ok).toBe(false);
  });

  it('refuse un JSON qui n’est pas une sauvegarde Allure', () => {
    const check = readBackup(raw({ hello: 'world' }));
    expect(check).toEqual({ ok: false, reason: "Ce fichier n'est pas une sauvegarde Allure." });
  });

  it('refuse une sauvegarde écrite par une version plus récente', () => {
    const check = readBackup(raw(validBackup({ version: 99 })));
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toContain('plus récente');
  });

  it('refuse des collections qui ne sont pas des tableaux', () => {
    const check = readBackup(raw({ ...validBackup(), workouts: 'oups' }));
    expect(check.ok).toBe(false);
  });

  it('refuse des entrées sans identifiant', () => {
    const check = readBackup(raw({ ...validBackup(), workouts: [{ name: 'sans id' }] }));
    expect(check.ok).toBe(false);
  });

  it('refuse une sauvegarde sans réglages', () => {
    const check = readBackup(raw({ ...validBackup(), settings: null }));
    expect(check.ok).toBe(false);
  });
});

describe('readBackup — ce qui est accepté', () => {
  it('lit une sauvegarde valide et la résume', () => {
    const check = readBackup(raw(validBackup()));
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.summary).toEqual({
      exportedAt: Date.parse('2026-09-06T18:30:00'),
      workouts: 2,
      activities: 1,
      templates: 0,
      activityDistanceM: 10000,
    });
  });

  it('accepte une sauvegarde plus ancienne que le format courant', () => {
    expect(readBackup(raw(validBackup({ version: 0 }))).ok).toBe(true);
  });

  it('ignore une distance non numérique au lieu de propager NaN', () => {
    const check = readBackup(
      raw({ ...validBackup(), activities: [{ id: 'a1', distanceM: 'beaucoup' }] }),
    );
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.summary.activityDistanceM).toBe(0);
  });
});

describe('backupFileName', () => {
  it('produit un nom qui se trie par date', () => {
    const early = backupFileName(Date.parse('2026-01-02T03:04:00'));
    const late = backupFileName(Date.parse('2026-11-02T03:04:00'));
    expect(early).toBe('allure-2026-01-02-0304.json');
    expect([late, early].sort()).toEqual([early, late]);
  });

  it('accepte un préfixe, pour dire pourquoi le fichier existe', () => {
    expect(backupFileName(Date.parse('2026-09-06T18:30:00'), 'avant-restauration')).toBe(
      'avant-restauration-2026-09-06-1830.json',
    );
  });
});
