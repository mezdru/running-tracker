// Les rapports de contraste de la palette, vérifiés plutôt que supposés.
//
// L'app est lue en courant, souvent en plein soleil : un gris « qui a l'air
// bien » sur un écran de bureau à pleine luminosité peut disparaître dehors.
// Toute modification d'une couleur de `theme/index.ts` doit se justifier par un
// chiffre d'ici — au même titre que les constantes du filtre GPS.
import { colors, zonePalette } from './index';

/** Luminance relative WCAG 2.1. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Aplatit une couleur semi-transparente sur son fond, comme le ferait iOS. */
function flatten(color: string, alpha: number, background: string): string {
  const mix = [1, 3, 5].map((offset) => {
    const front = parseInt(color.slice(offset, offset + 2), 16);
    const back = parseInt(background.slice(offset, offset + 2), 16);
    return Math.round(front * alpha + back * (1 - alpha));
  });
  return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const SURFACES = {
  bg: colors.bg,
  surface: colors.surface,
  surfaceAlt: colors.surfaceAlt,
  surfaceHi: colors.surfaceHi,
};

// AA pour du texte de taille normale. Aucun gris de l'app n'est assez gros pour
// bénéficier du seuil abaissé de 3:1 : le plus petit, `type.label`, fait 12 px.
const AA_TEXT = 4.5;
// AA pour ce qui n'est pas du texte : contour d'une zone tappable, barre d'un
// graphique, pastille de légende.
const AA_NON_TEXT = 3;

describe('contraste de la palette', () => {
  const inks = { text: colors.text, textMuted: colors.textMuted, textFaint: colors.textFaint };

  for (const [inkName, ink] of Object.entries(inks)) {
    for (const [surfaceName, surface] of Object.entries(SURFACES)) {
      it(`${inkName} sur ${surfaceName} atteint AA`, () => {
        expect(contrast(ink, surface)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }

  it('les couleurs d’état restent lisibles sur une carte', () => {
    for (const ink of [colors.danger, colors.success, colors.warning, colors.accent]) {
      expect(contrast(ink, colors.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('l’encre des boutons et pastilles actives contraste avec chaque teinte', () => {
    // Une pastille active se peint de sa couleur d'allure et écrit par-dessus
    // en `accentInk` : c'est vrai du violet de sprint comme du vert d'action.
    for (const tint of [colors.accent, ...zonePalette]) {
      expect(contrast(colors.accentInk, tint)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('une pastille inactive reste lisible sur son fond teinté', () => {
    // `Chip` peint le fond avec la teinte à 13 % (`${tint}22`) et écrit dans la
    // teinte pleine par-dessus : c'est ce couple-là qu'on lit à l'écran, pas la
    // teinte sur la carte nue.
    for (const tint of zonePalette) {
      const filled = flatten(tint, 0x22 / 255, colors.surface);
      expect(contrast(tint, filled)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('un bord porteur de sens se distingue de son fond', () => {
    // Contour de la journée « Repos », barre « prévu » des graphiques, poignée
    // de feuille modale : ces traits portent l'information à eux seuls.
    expect(contrast(colors.borderStrong, colors.bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrast(colors.borderStrong, colors.surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});
