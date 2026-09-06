// Réglages de l'app. Un seul objet, sérialisé clé par clé dans la table
// `settings` : ajouter un réglage n'exige donc aucune migration, et une clé
// absente retombe sur sa valeur par défaut.
import { DEFAULT_VMA_KMH, DEFAULT_ZONES, type PaceZone } from '@/entities/pace/model';

/**
 * Version du jeu de zones intégrées. Incrémentée quand une zone est AJOUTÉE
 * aux valeurs par défaut, pour qu'une installation existante la reçoive sans
 * perdre ses réglages — et sans que la zone revienne indéfiniment si
 * l'utilisateur la supprime ensuite (cf. `loadSettings`).
 *   1 → jeu initial
 *   2 → ajout de la marche
 */
export const ZONES_VERSION = 2;

export type Settings = {
  /** Vitesse maximale aérobie, en km/h : la référence de toutes les allures. */
  vmaKmh: number;
  zones: PaceZone[];
  /** Cf. `ZONES_VERSION`. */
  zonesVersion: number;
  /** Annonces vocales des changements d'étape. */
  voiceEnabled: boolean;
  /** Bips courts : trois avant la fin d'une étape, un au changement. */
  beepsEnabled: boolean;
  /** Décompte avant le départ, en secondes (0 pour partir immédiatement). */
  countdownS: number;
  /** Annonce automatique tous les N kilomètres (0 pour la désactiver). */
  autoLapKm: number;
  /**
   * Suspension automatique du chrono à l'arrêt. Utile aux séances urbaines
   * coupées de feux rouges, gênante sur piste où on s'arrête volontairement
   * entre deux séries — d'où le réglage.
   */
  autoPause: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  vmaKmh: DEFAULT_VMA_KMH,
  zones: DEFAULT_ZONES,
  zonesVersion: ZONES_VERSION,
  voiceEnabled: true,
  beepsEnabled: true,
  countdownS: 5,
  autoLapKm: 1,
  autoPause: false,
};
