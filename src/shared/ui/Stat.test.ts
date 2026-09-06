import { fitFontSize } from './Stat';

describe('fitFontSize', () => {
  it('laisse la taille de base tant que la valeur entre dans la colonne', () => {
    expect(fitFontSize(32, 3, 6)).toBe(32); // « 440 »
    expect(fitFontSize(32, 6, 6)).toBe(32); // « 45 min »
  });

  it('réduit proportionnellement au dépassement', () => {
    // « 36 h 21 » : sept signes pour un budget de six.
    expect(fitFontSize(32, 7, 6)).toBe(27);
    expect(fitFontSize(32, 8, 6)).toBe(24);
  });

  it('accepte un poids fractionnaire, l’unité comptant pour une part de signe', () => {
    // « 440,0 » suivi de « km » : cinq signes plus le poids de l'unité.
    expect(fitFontSize(32, 5 + 2 * 0.45 + 0.4, 6)).toBe(30);
  });

  it('ne descend pas sous 62 % de la taille de base', () => {
    // Au-delà, le chiffre ne fait plus l'effet d'un total : c'est la valeur
    // qu'il faut raccourcir, pas la police.
    expect(fitFontSize(32, 40, 6)).toBe(20);
  });
});
