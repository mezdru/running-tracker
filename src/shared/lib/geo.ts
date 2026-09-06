// Calculs géographiques du suivi GPS. Isolés du moteur de séance pour être
// testables sans appareil : c'est ici que se joue la justesse de la distance
// affichée, donc de toute la séance.

export type TrackPoint = {
  /** Horodatage absolu, en millisecondes. */
  t: number;
  lat: number;
  lon: number;
  /** Altitude en mètres, `null` si le capteur ne la donne pas. */
  alt: number | null;
  /** Précision horizontale annoncée, en mètres (écart-type, ~68 %). */
  acc: number;
  /**
   * Vitesse instantanée annoncée par le capteur, en m/s (`null` si absente).
   * Sur iOS elle est dérivée de l'effet DOPPLER et non d'une différence de
   * positions : elle est bien plus précise que la position elle-même, et c'est
   * pour cela que le filtre s'en sert (cf. features/run/gps-filter).
   */
  spd: number | null;
  /** Cap suivi, en degrés depuis le nord géographique (`null` si absent). */
  course?: number | null;
  /** Précision verticale annoncée, en mètres. */
  altAcc?: number | null;
};

const EARTH_RADIUS_M = 6_371_008.8;

/** Distance orthodromique entre deux points, en mètres. */
export function haversine(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Dénivelé positif cumulé, en mètres.
 *
 * Le seuil reste indispensable même sur une altitude déjà lissée par le filtre
 * (cf. features/run/gps-filter) : sans lui, le moindre résidu d'oscillation
 * s'additionnerait sur plusieurs milliers de relevés et fabriquerait des
 * centaines de mètres de dénivelé sur un parcours plat. 2 m parce que l'entrée
 * est lissée — sur de l'altitude brute il en faudrait 3 à 5.
 */
export function elevationGain(points: TrackPoint[], thresholdM = 2): number {
  let gain = 0;
  let reference: number | null = null;
  for (const p of points) {
    if (p.alt == null) continue;
    if (reference == null) {
      reference = p.alt;
      continue;
    }
    const delta = p.alt - reference;
    if (delta >= thresholdM) {
      gain += delta;
      reference = p.alt;
    } else if (delta <= -thresholdM) {
      reference = p.alt;
    }
  }
  return Math.round(gain);
}

/** Cadre géographique englobant la trace, pour centrer la carte dessus. */
export function boundsOf(points: { lat: number; lon: number }[]) {
  if (points.length === 0) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLon = points[0].lon;
  let maxLon = points[0].lon;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Plafonne le nombre de points, en gardant le premier et le dernier.
 *
 * Filet de sécurité appliqué APRÈS `simplifyPath` : sur un parcours très
 * sinueux, Douglas–Peucker peut légitimement conserver des milliers de points,
 * et une polyligne aussi dense fige la carte sans rien montrer de plus à
 * l'échelle d'un écran.
 */
export function simplifyTrack<T>(points: T[], maxPoints = 600): T[] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints - 1; i += 1) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

// --- Plan tangent local -----------------------------------------------------

/**
 * Mètres par degré de latitude et de longitude à une latitude donnée
 * (approximation WGS84, exacte à mieux qu'un centimètre sur les distances qui
 * nous concernent).
 *
 * Travailler en mètres dans un repère local plutôt qu'en degrés n'est pas un
 * détail : le filtre de Kalman a besoin d'un espace métrique et isotrope pour
 * que ses variances aient un sens. En degrés, un mètre vaudrait deux fois plus
 * en longitude qu'en latitude sous nos latitudes, et le filtre lisserait deux
 * fois plus dans un sens que dans l'autre.
 */
export function metersPerDegree(latitude: number): { lat: number; lon: number } {
  const phi = (latitude * Math.PI) / 180;
  return {
    lat:
      111132.92 -
      559.82 * Math.cos(2 * phi) +
      1.175 * Math.cos(4 * phi) -
      0.0023 * Math.cos(6 * phi),
    lon:
      111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + 0.118 * Math.cos(5 * phi),
  };
}

/**
 * Simplification de Douglas–Peucker : supprime les points qui s'écartent de
 * moins de `toleranceM` de la ligne qu'ils sont censés décrire.
 *
 * Préférée à un échantillonnage « un point sur N » pour le tracé sur carte :
 * l'échantillonnage régulier coupe les virages au hasard et redresse les
 * lacets, alors que Douglas–Peucker garde exactement les points qui portent la
 * FORME du parcours et jette ceux qui n'apportent rien.
 */
export function simplifyPath<T extends { lat: number; lon: number }>(
  points: T[],
  toleranceM = 2,
): T[] {
  if (points.length <= 2) return points;
  const scale = metersPerDegree(points[0].lat);
  const x = points.map((p) => p.lon * scale.lon);
  const y = points.map((p) => p.lat * scale.lat);

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  // Pile explicite plutôt que récursion : une trace d'une heure fait quelques
  // milliers de points et une récursion profonde n'a rien à faire ici.
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    if (last <= first + 1) continue;

    const dx = x[last] - x[first];
    const dy = y[last] - y[first];
    const norm = Math.hypot(dx, dy);

    let worst = -1;
    let worstIndex = -1;
    for (let i = first + 1; i < last; i += 1) {
      // Distance du point au segment ; si le segment est dégénéré (aller-retour
      // sur place), on retombe sur la distance au point de départ.
      const distance =
        norm === 0
          ? Math.hypot(x[i] - x[first], y[i] - y[first])
          : Math.abs(dy * (x[i] - x[first]) - dx * (y[i] - y[first])) / norm;
      if (distance > worst) {
        worst = distance;
        worstIndex = i;
      }
    }

    if (worst > toleranceM && worstIndex > 0) {
      keep[worstIndex] = 1;
      stack.push([first, worstIndex], [worstIndex, last]);
    }
  }

  return points.filter((_, index) => keep[index] === 1);
}
