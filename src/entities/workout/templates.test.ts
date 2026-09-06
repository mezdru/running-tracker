import { DEFAULT_ZONES } from '@/entities/pace/model';

import { builtinTemplates } from './templates';
import { blockSteps } from './model';

describe('modèles intégrés', () => {
  const templates = builtinTemplates();

  it('ne référencent que des allures existantes', () => {
    // Garde-fou : un modèle qui pointe vers une zone absente produirait une
    // séance sans allure, donc sans estimation ni consigne vocale — et l'erreur
    // ne se verrait qu'en ouvrant ce modèle-là.
    const known = new Set(DEFAULT_ZONES.map((zone) => zone.id));
    for (const template of templates) {
      for (const block of template.blocks) {
        for (const step of blockSteps(block)) {
          expect(known).toContain(step.zoneId);
        }
      }
    }
  });

  it('proposent des séances à récupération marchée', () => {
    const walking = templates.filter((template) =>
      template.blocks.some((block) => blockSteps(block).some((step) => step.kind === 'walk')),
    );
    expect(walking.length).toBeGreaterThanOrEqual(3);
  });

  it('donnent des identifiants distincts à chaque appel', () => {
    // Deux appels ne doivent jamais partager d'identifiant : sinon appliquer un
    // modèle éditerait la séance issue du précédent.
    const first = builtinTemplates()[0].blocks[0].id;
    const second = builtinTemplates()[0].blocks[0].id;
    expect(first).not.toBe(second);
  });
});
