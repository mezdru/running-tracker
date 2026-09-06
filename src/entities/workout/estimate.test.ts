import { estimateBlocks, estimateTarget, flattenBlocks } from './estimate';
import { makeStep, repeatBlock, singleBlock, type Block } from './model';

// 5:00/km pour l'endurance, 3:45/km pour la VMA : des valeurs rondes, pour que
// les attentes des tests restent lisibles.
const paces = { ef: 300, vma: 225 };

describe('estimateTarget', () => {
  it('déduit la durée d’une distance', () => {
    expect(estimateTarget({ type: 'distance', meters: 2000 }, 300)).toEqual({
      distanceM: 2000,
      durationS: 600,
    });
  });

  it('déduit la distance d’une durée', () => {
    expect(estimateTarget({ type: 'time', seconds: 600 }, 300)).toEqual({
      distanceM: 2000,
      durationS: 600,
    });
  });

  it('ne propage pas de NaN quand l’allure est inconnue', () => {
    expect(estimateTarget({ type: 'distance', meters: 1000 }, 0)).toEqual({
      distanceM: 1000,
      durationS: 0,
    });
  });
});

describe('estimateBlocks', () => {
  const blocks: Block[] = [
    singleBlock(makeStep({ kind: 'warmup', zoneId: 'ef', target: { type: 'time', seconds: 900 } })),
    repeatBlock(8, [
      makeStep({ kind: 'interval', zoneId: 'vma', target: { type: 'distance', meters: 400 } }),
      makeStep({ kind: 'recovery', zoneId: 'ef', target: { type: 'time', seconds: 60 } }),
    ]),
    singleBlock(
      makeStep({ kind: 'cooldown', zoneId: 'ef', target: { type: 'time', seconds: 600 } }),
    ),
  ];

  it('multiplie le contenu d’un bloc répété', () => {
    const estimate = estimateBlocks(blocks, paces);
    // Échauffement 15 min (3 km) + 8 × (400 m + 1 min à 5:00 = 200 m)
    // + retour au calme 10 min (2 km) = 3000 + 4800 + 2000 m.
    expect(Math.round(estimate.distanceM)).toBe(9800);
    // 900 + 8 × (90 + 60) + 600 = 2700 s.
    expect(Math.round(estimate.durationS)).toBe(2700);
  });

  it('rend zéro pour une séance vide', () => {
    expect(estimateBlocks([], paces)).toEqual({ distanceM: 0, durationS: 0 });
  });

  it('ignore un bloc répété zéro fois', () => {
    expect(estimateBlocks([repeatBlock(0, [makeStep({ zoneId: 'ef' })])], paces)).toEqual({
      distanceM: 0,
      durationS: 0,
    });
  });
});

describe('flattenBlocks', () => {
  it('déroule les répétitions en étapes indépendantes', () => {
    const blocks = [
      singleBlock(makeStep({ kind: 'warmup', zoneId: 'ef' })),
      repeatBlock(3, [
        makeStep({ kind: 'interval', zoneId: 'vma' }),
        makeStep({ kind: 'recovery', zoneId: 'ef' }),
      ]),
    ];
    const steps = flattenBlocks(blocks);
    expect(steps).toHaveLength(7);
    expect(steps[1].label).toBe('Intervalle 1/3');
    expect(steps[5].label).toBe('Intervalle 3/3');
    // Chaque occurrence doit être adressable séparément par le moteur.
    expect(new Set(steps.map((s) => s.key)).size).toBe(7);
  });
});
