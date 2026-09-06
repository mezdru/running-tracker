import { elevationGain, haversine, simplifyPath, simplifyTrack, type TrackPoint } from './geo';

const point = (p: Partial<TrackPoint>): TrackPoint => ({
  t: 0,
  lat: 48.8566,
  lon: 2.3522,
  alt: null,
  acc: 5,
  spd: null,
  ...p,
});

describe('haversine', () => {
  it('mesure une distance connue au mètre près', () => {
    // Un centième de degré de latitude ≈ 1111 m, partout sur le globe.
    const d = haversine({ lat: 48.85, lon: 2.35 }, { lat: 48.86, lon: 2.35 });
    expect(d).toBeGreaterThan(1105);
    expect(d).toBeLessThan(1115);
  });
});

describe('elevationGain', () => {
  it('ignore le bruit d’altitude sous le seuil', () => {
    const flat = [0, 1, -1, 1.5, -1.5, 1].map((alt, i) => point({ t: i * 1000, alt }));
    expect(elevationGain(flat)).toBe(0);
  });

  it('cumule les montées franches', () => {
    // 0 → 10 en deux paliers, un creux à 8, puis 8 → 20 : la redescente de 2 m
    // dépasse le seuil, donc elle abaisse la référence et les 12 m qui suivent
    // comptent en entier. 10 + 12 = 22, comme le ferait une montre.
    const climb = [0, 5, 10, 8, 20].map((alt, i) => point({ t: i * 1000, alt }));
    expect(elevationGain(climb)).toBe(22);
  });
});

describe('simplifyTrack', () => {
  it('conserve les extrémités', () => {
    const points = Array.from({ length: 5000 }, (_, i) => i);
    const out = simplifyTrack(points, 100);
    expect(out).toHaveLength(100);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(4999);
  });
});

describe('simplifyPath', () => {
  it('supprime les points alignés et garde les virages', () => {
    // Un « L » : dix points alignés vers l'est, puis dix vers le nord. Seuls
    // les trois sommets portent la forme.
    const path = [
      ...Array.from({ length: 10 }, (_, i) => ({ lat: 48.8, lon: 2.3 + i * 0.001 })),
      ...Array.from({ length: 10 }, (_, i) => ({ lat: 48.8 + (i + 1) * 0.001, lon: 2.309 })),
    ];
    expect(simplifyPath(path, 5)).toHaveLength(3);
  });

  it('conserve un tracé déjà minimal', () => {
    const path = [
      { lat: 48.8, lon: 2.3 },
      { lat: 48.81, lon: 2.31 },
    ];
    expect(simplifyPath(path, 2)).toHaveLength(2);
  });
});
