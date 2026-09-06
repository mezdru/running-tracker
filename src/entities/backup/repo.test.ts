import type { Backup } from './model';
import { linkableWorkoutId, restoreBackup } from './repo';

describe('linkableWorkoutId', () => {
  // Une activité dont la séance a disparu ne doit JAMAIS faire échouer la
  // restauration : la contrainte de clé étrangère refuserait l'insertion et
  // l'effort couru serait perdu — l'inverse exact du but d'une sauvegarde.
  it('dénoue le lien vers une séance absente', () => {
    expect(linkableWorkoutId('w-disparue', [{ id: 'w1' }], new Set())).toBeNull();
  });

  it('garde le lien vers une séance restaurée dans le même fichier', () => {
    expect(linkableWorkoutId('w1', [{ id: 'w1' }], new Set())).toBe('w1');
  });

  it('garde le lien vers une séance déjà présente en base', () => {
    // Cas de la fusion : la séance n'est pas dans le fichier parce qu'elle
    // existe déjà.
    expect(linkableWorkoutId('w1', [], new Set(['w1']))).toBe('w1');
  });

  it('laisse une sortie libre sans séance', () => {
    expect(linkableWorkoutId(null, [{ id: 'w1' }], new Set())).toBeNull();
  });
});

describe('restoreBackup', () => {
  const backup: Backup = {
    format: 'allure-backup',
    version: 1,
    exportedAt: Date.now(),
    appVersion: '1.0.0',
    settings: { vmaKmh: 16, zones: [] } as unknown as Backup['settings'],
    workouts: [],
    activities: [],
    templates: [],
  };

  it('n’ouvre pas de transaction imbriquée en mode remplacement', () => {
    // Régression : la restauration écrivait les réglages via `saveSettings`,
    // qui ouvrait sa PROPRE transaction à l'intérieur de celle de la
    // restauration. SQLite refusait alors la validation, et l'app affichait
    // « Restauration impossible » sur une sauvegarde parfaitement valide.
    expect(() => restoreBackup(backup, 'replace')).not.toThrow();
  });

  it('n’ouvre pas non plus de transaction imbriquée en fusion', () => {
    expect(() => restoreBackup(backup, 'merge')).not.toThrow();
  });
});
