import { haversine, type TrackPoint } from '@/shared/lib/geo';

import { createFilter, ingestPoint } from './gps-filter';

/**
 * Générateur pseudo-aléatoire déterministe (xorshift32) : un test sur du bruit
 * n'a d'intérêt que s'il est reproductible à l'identique.
 */
function noise(seed = 42) {
  let x = seed;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    // Somme de deux tirages uniformes : approximation grossière mais suffisante
    // d'une loi normale centrée réduite.
    return (x / 0xffffffff) * 2 - 1;
  };
}

const ORIGIN = { lat: 48.8566, lon: 2.3522 };
const M_PER_DEG_LAT = 111_132;
const M_PER_DEG_LON = 73_300; // à 48,86° de latitude

type Sample = { east: number; north: number; t: number };

function toPoint(sample: Sample, acc: number, extra: Partial<TrackPoint> = {}): TrackPoint {
  return {
    t: sample.t,
    lat: ORIGIN.lat + sample.north / M_PER_DEG_LAT,
    lon: ORIGIN.lon + sample.east / M_PER_DEG_LON,
    alt: null,
    acc,
    spd: null,
    course: null,
    ...extra,
  };
}

/** Ligne droite vers l'est à vitesse constante, bruitée sur les deux axes. */
function straightLine(options: {
  seconds: number;
  speed: number;
  sigma: number;
  withDoppler: boolean;
}) {
  const random = noise();
  const points: TrackPoint[] = [];
  for (let i = 0; i <= options.seconds; i += 1) {
    const truthEast = i * options.speed;
    points.push(
      toPoint(
        {
          t: 1_700_000_000_000 + i * 1000,
          east: truthEast + random() * options.sigma,
          north: random() * options.sigma,
        },
        5,
        options.withDoppler ? { spd: options.speed, course: 90 } : {},
      ),
    );
  }
  return { points, truth: options.seconds * options.speed };
}

/** Distance obtenue en reliant bêtement les points bruts. */
function rawDistance(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += haversine(points[i - 1], points[i]);
  return total;
}

function filteredDistance(points: TrackPoint[]): number {
  const state = createFilter();
  let total = 0;
  for (const point of points) {
    const result = ingestPoint(state, point);
    if (result.kind === 'accepted') total += result.distance;
  }
  return total;
}

describe('rejets', () => {
  it('écarte un relevé antérieur au dernier accepté', () => {
    const state = createFilter();
    ingestPoint(state, toPoint({ t: 1000, east: 0, north: 0 }, 5));
    const result = ingestPoint(state, toPoint({ t: 900, east: 3, north: 0 }, 5));
    expect(result).toEqual({ kind: 'rejected', reason: 'stale' });
  });

  it('écarte un relevé trop imprécis', () => {
    const state = createFilter();
    const result = ingestPoint(state, toPoint({ t: 1000, east: 0, north: 0 }, 60));
    expect(result).toEqual({ kind: 'rejected', reason: 'inaccurate' });
  });

  it('écarte un saut physiquement impossible', () => {
    const state = createFilter();
    for (let i = 0; i < 10; i += 1) {
      ingestPoint(state, toPoint({ t: 1000 + i * 1000, east: i * 3, north: 0 }, 5));
    }
    // Un kilomètre en une seconde : recalage du capteur, pas un déplacement.
    const result = ingestPoint(state, toPoint({ t: 11_000, east: 1000, north: 0 }, 5));
    expect(result).toEqual({ kind: 'rejected', reason: 'impossible' });
  });
});

describe('démarrage à froid', () => {
  it('ne compte aucune distance tant que la position n’est pas fiable', () => {
    const state = createFilter();
    let total = 0;
    // Trois relevés à 20 m de précision : acceptables pour la trace, pas assez
    // bons pour armer la mesure.
    for (let i = 0; i < 3; i += 1) {
      const result = ingestPoint(state, toPoint({ t: 1000 + i * 1000, east: i * 4, north: 0 }, 20));
      if (result.kind === 'accepted') {
        total += result.distance;
        expect(result.ready).toBe(false);
      }
    }
    expect(total).toBe(0);
  });

  it('s’arme dès que la précision devient bonne', () => {
    const state = createFilter();
    let ready = false;
    for (let i = 0; i < 5; i += 1) {
      const result = ingestPoint(state, toPoint({ t: 1000 + i * 1000, east: i * 4, north: 0 }, 6));
      if (result.kind === 'accepted') ready = result.ready;
    }
    expect(ready).toBe(true);
  });
});

describe('ligne droite bruitée', () => {
  it('ne gonfle pas la distance, là où les points bruts la gonflent', () => {
    // Dix minutes à 3,3 m/s (5:03/km) avec 5 m de bruit sur chaque axe.
    //
    // Mesures obtenues avec ce générateur, sans vitesse Doppler :
    //   bruit 3 m → brut +33 %, filtré +2,6 %
    //   bruit 5 m → brut +82 %, filtré +4,5 %
    //   bruit 8 m → brut +169 %, filtré +3,5 %
    // Avec le Doppler, l'écart filtré reste sous 1 % dans les trois cas.
    const { points, truth } = straightLine({
      seconds: 600,
      speed: 3.3,
      sigma: 5,
      withDoppler: false,
    });

    const raw = rawDistance(points);
    const filtered = filteredDistance(points);

    // Le tracé brut surestime nettement — c'est précisément ce que le filtre
    // existe pour corriger. Si cette assertion tombe un jour, c'est que le
    // générateur de bruit ne représente plus rien.
    expect(raw).toBeGreaterThan(truth * 1.15);

    // Le filtré reste à quelques pour cent de la vérité.
    expect(filtered).toBeGreaterThan(truth * 0.95);
    expect(filtered).toBeLessThan(truth * 1.06);
  });

  it('fait encore mieux avec la vitesse Doppler', () => {
    const withDoppler = straightLine({
      seconds: 600,
      speed: 3.3,
      sigma: 5,
      withDoppler: true,
    });
    const filtered = filteredDistance(withDoppler.points);
    expect(Math.abs(filtered - withDoppler.truth)).toBeLessThan(withDoppler.truth * 0.04);
  });
});

describe('à l’arrêt', () => {
  it('n’invente pas de distance quand on ne bouge pas', () => {
    const random = noise(7);
    const state = createFilter();
    let total = 0;
    // Deux minutes immobile, avec la dérive habituelle du capteur.
    for (let i = 0; i <= 120; i += 1) {
      const result = ingestPoint(
        state,
        toPoint(
          { t: 1_700_000_000_000 + i * 1000, east: random() * 4, north: random() * 4 },
          5,
          { spd: 0, course: -1 },
        ),
      );
      if (result.kind === 'accepted') total += result.distance;
    }
    expect(total).toBeLessThan(15);
  });
});

describe('virages', () => {
  it('suit un parcours anguleux sans couper les angles', () => {
    // Carré de 100 m de côté parcouru à 3 m/s, mesure propre (2 m).
    const state = createFilter();
    const legs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    let east = 0;
    let north = 0;
    let t = 1_700_000_000_000;
    let total = 0;
    for (const [dx, dy] of legs) {
      for (let i = 0; i < 34; i += 1) {
        east += dx * 3;
        north += dy * 3;
        t += 1000;
        const result = ingestPoint(state, toPoint({ t, east, north }, 2));
        if (result.kind === 'accepted') total += result.distance;
      }
    }
    // 4 × 102 m = 408 m, moins le temps d'armement de la mesure.
    expect(total).toBeGreaterThan(370);
    expect(total).toBeLessThan(430);
  });
});

describe('altitude', () => {
  it('lisse le bruit vertical', () => {
    const random = noise(3);
    const state = createFilter();
    let last = 0;
    for (let i = 0; i <= 60; i += 1) {
      const result = ingestPoint(
        state,
        toPoint({ t: 1_700_000_000_000 + i * 1000, east: i * 3, north: 0 }, 5, {
          alt: 100 + random() * 8,
          altAcc: 8,
        }),
      );
      if (result.kind === 'accepted' && result.point.alt != null) last = result.point.alt;
    }
    // L'altitude vraie est 100 m : le lissage doit s'en approcher nettement
    // plus que ne le fait un relevé isolé (± 8 m).
    expect(Math.abs(last - 100)).toBeLessThan(3);
  });
});
