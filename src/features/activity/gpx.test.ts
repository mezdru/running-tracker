import type { Activity } from '@/entities/activity/model';

import { toGpx } from './gpx';

const BASE = Date.parse('2026-09-06T08:00:00Z');

const activity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'a1',
  workoutId: null,
  startedAt: BASE,
  endedAt: BASE + 1800_000,
  distanceM: 6000,
  durationS: 1800,
  movingS: 1800,
  elevGainM: 30,
  track: [
    { t: BASE, lat: 48.8566, lon: 2.3522, alt: 35.2, acc: 5, spd: 3.3 },
    { t: BASE + 1000, lat: 48.8567, lon: 2.3523, alt: null, acc: 5, spd: 3.3 },
  ],
  splits: [],
  laps: [],
  stravaActivityId: null,
  stravaSharedAt: null,
  createdAt: BASE,
  ...overrides,
});

describe('toGpx', () => {
  // Ce fichier est lu par Strava : sa forme n'est pas une affaire de goût.
  const gpx = toGpx(activity(), 'Fractionné 30/30');

  it('produit un GPX 1.1 déclaré', () => {
    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(gpx.trimEnd().endsWith('</gpx>')).toBe(true);
  });

  it('horodate chaque point', () => {
    // Sans horodatage, Strava importe le fichier comme un ITINÉRAIRE et non
    // comme une activité : ni temps, ni allure, ni séance.
    expect(gpx).toContain('<time>2026-09-06T08:00:00.000Z</time>');
    expect(gpx.match(/<trkpt /g)).toHaveLength(2);
    expect(gpx.match(/<time>/g)?.length).toBe(3); // métadonnée + deux points
  });

  it('n’émet une altitude que lorsqu’elle existe', () => {
    expect(gpx).toContain('<ele>35.2</ele>');
    expect(gpx.match(/<ele>/g)).toHaveLength(1);
  });

  it('échappe les caractères qui casseraient le XML', () => {
    const escaped = toGpx(activity(), 'Séance <VMA> & "seuil"');
    expect(escaped).toContain('S&#233;ance &lt;VMA&gt; &amp; &quot;seuil&quot;'.replace('&#233;', 'é'));
    expect(escaped).not.toContain('<VMA>');
  });

  it('annonce une activité de course', () => {
    expect(gpx).toContain('<type>running</type>');
  });
});
