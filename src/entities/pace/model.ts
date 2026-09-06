// Allures cibles. Une zone n'enregistre pas une allure figée mais, par défaut,
// un POURCENTAGE DE VMA : c'est la façon dont un plan se raisonne en français
// (« 10 × 400 m à 100 % VMA »), et surtout ça veut dire qu'une seule valeur —
// la VMA — remet tout le plan à jour quand la forme évolue. Une zone peut
// malgré tout porter une allure absolue, pour un objectif chronométré (« allure
// marathon 4:15 ») qui ne doit pas bouger avec la VMA.
import { zonePalette } from '@/shared/theme';

export type PaceZone = {
  id: string;
  /** Nom complet, affiché dans les réglages et l'éditeur. */
  name: string;
  /** Abréviation affichée sur les pastilles de séance (« EF », « VMA »). */
  short: string;
  color: string;
  mode: 'vma' | 'pace';
  /** Pourcentage de VMA (mode `vma`), ex. 85 pour 85 %. */
  vmaPercent: number;
  /** Allure absolue en secondes/km (mode `pace`). */
  paceSecPerKm: number;
};

/** VMA de départ, en km/h — remplacée dès le premier passage dans les réglages. */
export const DEFAULT_VMA_KMH = 16;

/**
 * Zones par défaut, du plus lent au plus rapide. L'ordre est significatif :
 * il alimente la palette d'intensité et l'ordre des sélecteurs, si bien qu'une
 * séance se lit comme un profil d'effort.
 */
export const DEFAULT_ZONES: PaceZone[] = [
  { id: 'z_recup', name: 'Récupération', short: 'RÉCUP', vmaPercent: 60 },
  { id: 'z_ef', name: 'Endurance fondamentale', short: 'EF', vmaPercent: 70 },
  { id: 'z_marathon', name: 'Allure marathon', short: 'AM', vmaPercent: 80 },
  { id: 'z_seuil', name: 'Seuil / allure semi', short: 'SEUIL', vmaPercent: 85 },
  { id: 'z_10k', name: 'Allure 10 km', short: '10K', vmaPercent: 90 },
  { id: 'z_vma', name: 'VMA', short: 'VMA', vmaPercent: 100 },
  { id: 'z_sprint', name: 'Sprint', short: 'SPRINT', vmaPercent: 110 },
].map((zone, index) => ({
  ...zone,
  mode: 'vma' as const,
  color: zonePalette[index % zonePalette.length],
  // Valeur de repli cohérente avec le pourcentage, utilisée seulement si la
  // zone bascule un jour en mode `pace` : elle ne doit pas être à zéro.
  paceSecPerKm: Math.round(3600 / (DEFAULT_VMA_KMH * (zone.vmaPercent / 100))),
}));

/** Allure effective d'une zone, en secondes par kilomètre. */
export function resolvePace(zone: PaceZone, vmaKmh: number): number {
  if (zone.mode === 'pace') return zone.paceSecPerKm;
  const speed = (vmaKmh * zone.vmaPercent) / 100;
  return speed > 0 ? 3600 / speed : 0;
}

/**
 * Table `id → allure`, construite une fois par rendu et passée aux calculs.
 * Les estimations doivent rester des fonctions pures : elles reçoivent cette
 * table, elles ne vont pas chercher les réglages elles-mêmes.
 */
export function paceTable(zones: PaceZone[], vmaKmh: number): Record<string, number> {
  const table: Record<string, number> = {};
  for (const zone of zones) table[zone.id] = resolvePace(zone, vmaKmh);
  return table;
}

export function findZone(zones: PaceZone[], id: string): PaceZone | undefined {
  return zones.find((zone) => zone.id === id);
}
