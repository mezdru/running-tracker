// Export GPX. En attendant la synchronisation Strava automatique, c'est le
// chemin le plus court pour verser une sortie dans Strava (ou n'importe quel
// autre service) : le fichier s'ouvre dans la feuille de partage iOS et Strava
// l'importe directement.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Activity } from '@/entities/activity/model';

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] ?? char,
  );
}

/** Sérialise une activité au format GPX 1.1 avec extension trace de temps. */
export function toGpx(activity: Activity, name: string): string {
  const points = activity.track
    .map((point) => {
      const elevation = point.alt != null ? `\n        <ele>${point.alt.toFixed(1)}</ele>` : '';
      return `      <trkpt lat="${point.lat.toFixed(6)}" lon="${point.lon.toFixed(6)}">${elevation}
        <time>${new Date(point.t).toISOString()}</time>
      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Allure" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${new Date(activity.startedAt).toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <type>running</type>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
}

/**
 * Écrit le GPX dans le cache et ouvre la feuille de partage. Le cache et non
 * les documents : le fichier n'a d'intérêt que le temps du partage, et iOS
 * peut le nettoyer ensuite sans rien perdre — l'activité, elle, reste en base.
 */
export async function shareGpx(activity: Activity, name: string): Promise<void> {
  const safeName = name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'sortie';
  const date = new Date(activity.startedAt).toISOString().slice(0, 10);
  const file = new File(Paths.cache, `${date}-${safeName}.gpx`);
  if (file.exists) file.delete();
  file.create();
  file.write(toGpx(activity, name));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/gpx+xml',
    dialogTitle: 'Exporter la sortie',
    UTI: 'com.topografix.gpx',
  });
}
