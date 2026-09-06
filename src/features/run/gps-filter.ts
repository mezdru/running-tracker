// Chaîne de filtrage du GPS. C'est ce module qui décide de la distance
// affichée et du tracé enregistré — donc de tout ce que la séance raconte
// ensuite.
//
// Le problème à résoudre est bien identifié : un GPS de téléphone livre une
// position par seconde avec une erreur de 3 à 10 m qui change de sens à chaque
// relevé. Relier ces points bruts donne un tracé en dents de scie, et surtout
// une distance SURESTIMÉE — les zigzags parasites s'additionnent, typiquement
// +3 à +8 % sur une sortie, davantage en ville ou sous les arbres. Aucun seuil
// simple ne corrige cela : il faut estimer la trajectoire réelle, pas
// sélectionner des points.
//
// Quatre étages, du plus grossier au plus fin :
//
//   1. rejet des relevés inexploitables (périmés, imprécis, physiquement
//      impossibles) ;
//   2. attente d'une première position fiable avant de compter quoi que ce
//      soit — les premières secondes d'un démarrage à froid sont les pires ;
//   3. filtre de KALMAN à vitesse constante, alimenté par la position ET par
//      la vitesse Doppler du récepteur, qui est bien plus précise ;
//   4. accumulation de la distance sur la trajectoire FILTRÉE, avec un seuil
//      de bruit dérivé de l'incertitude propre du filtre.
//
// La correspondance au réseau de chemins (« map matching ») n'est
// volontairement pas tentée : elle suppose un graphe routier et donc du réseau,
// alors que l'app est conçue pour fonctionner sans couverture — et elle est de
// toute façon fausse dès qu'on quitte les routes, ce qui arrive tout le temps
// en course à pied (piste, sentier, stade, plage).
import { metersPerDegree, type TrackPoint } from '@/shared/lib/geo';

/** Au-delà, le relevé est ignoré : trop imprécis pour dire quoi que ce soit. */
export const MAX_ACCURACY_M = 25;

/**
 * Précision exigée pour ARMER la mesure. Tant qu'aucun relevé n'atteint ce
 * niveau, la trace est enregistrée mais la distance reste à zéro : un
 * démarrage à froid produit des positions à 50-100 m qui, seules, ajoutent
 * plusieurs centaines de mètres jamais courus.
 */
const WARMUP_ACCURACY_M = 12;

/** Et au moins quelques relevés cohérents, pas un seul coup de chance. */
const WARMUP_MIN_FIXES = 3;

/**
 * Écart-type de l'accélération non modélisée, en m/s² : c'est le réglage
 * central du filtre. Trop bas, la trajectoire estimée devient rigide et coupe
 * les virages ; trop haut, le filtre suit le bruit et on n'a rien gagné.
 *
 * 0,35 est calé sur la réalité de la course à pied : une allure varie
 * lentement, et même une relance franche — passer de 3 à 5 m/s en trois
 * secondes — ne fait que 0,67 m/s² sur un seul intervalle. Mesuré sur la ligne
 * droite bruitée du fichier de tests, descendre de 0,8 à 0,35 ramène la
 * surestimation de +7 % à moins de 3 %.
 */
const SIGMA_ACCEL = 0.35;

/**
 * Écart-type de la vitesse Doppler annoncée par le récepteur. Volontairement
 * bas : cette mesure ne dérive pas de la position, elle est intrinsèquement
 * bien plus fiable, et c'est elle qui empêche le filtre de gonfler la distance
 * dans les zigzags.
 */
const SIGMA_SPEED = 0.7;

/** Vitesse au-delà de laquelle un relevé ne peut pas décrire un coureur (m/s). */
const MAX_SPEED_MS = 8;

/** En dessous, on considère qu'on est à l'arrêt et la distance ne monte plus. */
const STATIONARY_MS = 0.45;

/** Filtre de Kalman à deux états (position, vitesse) sur un axe. */
type Axis = {
  p: number;
  v: number;
  /** Covariance [[pp, pv], [vp, vv]]. */
  pp: number;
  pv: number;
  vp: number;
  vv: number;
};

export type FilterState = {
  /** Origine du repère local, posée sur le premier relevé retenu. */
  origin: { lat: number; lon: number; mLat: number; mLon: number } | null;
  east: Axis;
  north: Axis;
  /** Altitude lissée et sa variance (filtre à un seul état). */
  alt: number | null;
  altVar: number;
  lastT: number;
  /** Nombre de relevés suffisamment précis vus jusqu'ici. */
  goodFixes: number;
  /** Vrai une fois la mesure armée (cf. WARMUP_ACCURACY_M). */
  ready: boolean;
};

export type FilterOutcome =
  /** Relevé écarté : il n'entre ni dans la trace ni dans la distance. */
  | { kind: 'rejected'; reason: 'stale' | 'inaccurate' | 'impossible' }
  /** Relevé retenu. `distance` vaut 0 tant que la mesure n'est pas armée. */
  | {
      kind: 'accepted';
      point: TrackPoint;
      /** Distance ajoutée par ce relevé, en mètres. */
      distance: number;
      /** Vitesse estimée par le filtre, en m/s. */
      speed: number;
      /** Faux tant que le GPS n'a pas donné de position fiable. */
      ready: boolean;
    };

export function createFilter(): FilterState {
  return {
    origin: null,
    east: { p: 0, v: 0, pp: 0, pv: 0, vp: 0, vv: 0 },
    north: { p: 0, v: 0, pp: 0, pv: 0, vp: 0, vv: 0 },
    alt: null,
    altVar: 0,
    lastT: 0,
    goodFixes: 0,
    ready: false,
  };
}

/** Prédiction : on avance d'un pas de temps et l'incertitude grandit. */
function predict(axis: Axis, dt: number): void {
  axis.p += axis.v * dt;

  // Q d'un modèle à accélération blanche : σ²·[[dt⁴/4, dt³/2], [dt³/2, dt²]].
  const s2 = SIGMA_ACCEL * SIGMA_ACCEL;
  const q11 = (s2 * dt ** 4) / 4;
  const q12 = (s2 * dt ** 3) / 2;
  const q22 = s2 * dt * dt;

  const pp = axis.pp + dt * (axis.pv + axis.vp) + dt * dt * axis.vv + q11;
  const pv = axis.pv + dt * axis.vv + q12;
  const vp = axis.vp + dt * axis.vv + q12;
  const vv = axis.vv + q22;

  axis.pp = pp;
  axis.pv = pv;
  axis.vp = vp;
  axis.vv = vv;
}

/** Correction par une mesure de POSITION de variance `r`. */
function updatePosition(axis: Axis, z: number, r: number): void {
  const s = axis.pp + r;
  const kp = axis.pp / s;
  const kv = axis.vp / s;
  const y = z - axis.p;

  axis.p += kp * y;
  axis.v += kv * y;

  const pp = axis.pp;
  const pv = axis.pv;
  axis.pp -= kp * pp;
  axis.pv -= kp * pv;
  axis.vp -= kv * pp;
  axis.vv -= kv * pv;
}

/** Correction par une mesure de VITESSE de variance `r`. */
function updateVelocity(axis: Axis, z: number, r: number): void {
  const s = axis.vv + r;
  const kp = axis.pv / s;
  const kv = axis.vv / s;
  const y = z - axis.v;

  axis.p += kp * y;
  axis.v += kv * y;

  const vp = axis.vp;
  const vv = axis.vv;
  axis.pp -= kp * vp;
  axis.pv -= kp * vv;
  axis.vp -= kv * vp;
  axis.vv -= kv * vv;
}

/**
 * Intègre un relevé brut et rend le point corrigé plus la distance à ajouter.
 *
 * `state` est modifié en place : ce module est appelé une fois par seconde
 * pendant toute une séance, recopier la covariance à chaque relevé n'apporte
 * rien qu'un peu de ramasse-miettes.
 */
export function ingestPoint(state: FilterState, raw: TrackPoint): FilterOutcome {
  if (!Number.isFinite(raw.lat) || !Number.isFinite(raw.lon)) {
    return { kind: 'rejected', reason: 'inaccurate' };
  }
  // Un relevé antérieur au dernier accepté est un doublon ou un désordre de
  // livraison (fréquent au retour d'arrière-plan, où iOS livre un lot d'un
  // coup) : l'intégrer ferait reculer le filtre dans le temps.
  if (state.lastT > 0 && raw.t <= state.lastT) {
    return { kind: 'rejected', reason: 'stale' };
  }
  if (!(raw.acc > 0) || raw.acc > MAX_ACCURACY_M) {
    return { kind: 'rejected', reason: 'inaccurate' };
  }

  // Premier relevé : on pose l'origine du repère local et on initialise le
  // filtre sur la mesure elle-même.
  if (!state.origin) {
    const scale = metersPerDegree(raw.lat);
    state.origin = { lat: raw.lat, lon: raw.lon, mLat: scale.lat, mLon: scale.lon };
    const r = raw.acc * raw.acc;
    state.east = { p: 0, v: 0, pp: r, pv: 0, vp: 0, vv: 25 };
    state.north = { p: 0, v: 0, pp: r, pv: 0, vp: 0, vv: 25 };
    state.alt = raw.alt;
    state.altVar = (raw.altAcc ?? 10) ** 2;
    state.lastT = raw.t;
    state.goodFixes = raw.acc <= WARMUP_ACCURACY_M ? 1 : 0;
    return {
      kind: 'accepted',
      point: { ...raw },
      distance: 0,
      speed: 0,
      ready: false,
    };
  }

  const dt = (raw.t - state.lastT) / 1000;
  const zEast = (raw.lon - state.origin.lon) * state.origin.mLon;
  const zNorth = (raw.lat - state.origin.lat) * state.origin.mLat;

  // Garde-fou physique, évalué sur l'écart à la position ESTIMÉE : un
  // recalage brutal après une perte de signal (tunnel, immeuble) apparaît
  // comme un saut de plusieurs centaines de mètres en une seconde.
  const jump = Math.hypot(zEast - state.east.p, zNorth - state.north.p);
  // Tolérance élargie par l'incertitude du moment : après trente secondes sans
  // signal, un écart de cent mètres n'est plus une aberration mais une
  // correction légitime.
  const uncertainty = Math.sqrt(state.east.pp + state.north.pp);
  if (jump > MAX_SPEED_MS * Math.max(dt, 1) + 3 * uncertainty + raw.acc) {
    return { kind: 'rejected', reason: 'impossible' };
  }

  const previousEast = state.east.p;
  const previousNorth = state.north.p;

  predict(state.east, dt);
  predict(state.north, dt);

  const r = raw.acc * raw.acc;
  updatePosition(state.east, zEast, r);
  updatePosition(state.north, zNorth, r);

  // Vitesse Doppler : iOS rend une valeur négative quand elle est invalide.
  // Quand elle est là, c'est l'information la plus fiable de tout le relevé.
  if (raw.spd != null && raw.spd >= 0) {
    const rv = SIGMA_SPEED * SIGMA_SPEED;
    if (raw.spd < 0.5) {
      // Une vitesse nulle contraint les DEUX composantes, même sans cap — et
      // le cap est justement invalide à l'arrêt. C'est ce qui empêche la
      // dérive du capteur de fabriquer des dizaines de mètres pendant une
      // récupération debout.
      updateVelocity(state.east, 0, rv);
      updateVelocity(state.north, 0, rv);
    } else if (raw.course != null && raw.course >= 0) {
      const rad = (raw.course * Math.PI) / 180;
      updateVelocity(state.east, raw.spd * Math.sin(rad), rv);
      updateVelocity(state.north, raw.spd * Math.cos(rad), rv);
    }
  }

  // Altitude : filtre à un état, pondéré par la précision verticale annoncée.
  // Le dénivelé se calcule ensuite sur cette série lissée, jamais sur la série
  // brute qui oscille de plusieurs mètres d'un relevé à l'autre.
  if (raw.alt != null) {
    if (state.alt == null) {
      state.alt = raw.alt;
      state.altVar = (raw.altAcc ?? 10) ** 2;
    } else {
      const rAlt = (raw.altAcc ?? 10) ** 2;
      const predicted = state.altVar + 0.25 * Math.max(dt, 0.1);
      const k = predicted / (predicted + rAlt);
      state.alt += k * (raw.alt - state.alt);
      state.altVar = (1 - k) * predicted;
    }
  }

  state.lastT = raw.t;
  if (raw.acc <= WARMUP_ACCURACY_M) state.goodFixes += 1;
  if (!state.ready && state.goodFixes >= WARMUP_MIN_FIXES) state.ready = true;

  const speed = Math.hypot(state.east.v, state.north.v);
  const moved = Math.hypot(state.east.p - previousEast, state.north.p - previousNorth);

  // Seuil de bruit dérivé de l'incertitude du filtre lui-même, et non d'une
  // constante : quand le signal est bon, on compte des déplacements de
  // quelques dizaines de centimètres ; quand il se dégrade, le seuil monte
  // tout seul. S'y ajoute la porte d'arrêt, qui supprime la dérive résiduelle
  // pendant une récupération debout.
  const noiseFloor = 0.35 * Math.sqrt(state.east.pp + state.north.pp);
  const counted =
    state.ready && speed >= STATIONARY_MS && moved > noiseFloor ? moved : 0;

  return {
    kind: 'accepted',
    point: {
      ...raw,
      // La trace enregistrée est la trajectoire ESTIMÉE : c'est elle qui est
      // affichée sur la carte et exportée en GPX, et elle doit raconter la
      // même chose que la distance annoncée.
      lat: state.origin.lat + state.north.p / state.origin.mLat,
      lon: state.origin.lon + state.east.p / state.origin.mLon,
      alt: state.alt,
    },
    distance: counted,
    speed,
    ready: state.ready,
  };
}
