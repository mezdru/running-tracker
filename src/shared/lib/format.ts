// Formatage des grandeurs de course. Toutes les durées sont en secondes et
// toutes les distances en mètres dans le reste du code : la conversion en
// texte n'a lieu qu'ici, à l'affichage.

/** `03:24` sous l'heure, `1:03:24` au-delà. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Sous ce seuil, une durée garde ses secondes : `1 min 30`. */
const SECONDS_VISIBLE_BELOW = 600;

/** Durée compacte pour les résumés : `1 h 12`, `45 min`, `1 min 30`, `40 s`. */
export function formatDurationShort(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;

  const h = Math.floor(total / 3600);
  if (h === 0) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    // Les secondes ne sont montrées que sur les durées courtes — celles d'un
    // fractionné. Sans cela, 90 s et 120 s s'affichent tous deux « 2 min » et
    // deux raccourcis voisins deviennent indiscernables. Au-delà de dix
    // minutes, la seconde n'apporte rien à une estimation de séance.
    if (s === 0 || total >= SECONDS_VISIBLE_BELOW) return `${Math.round(total / 60)} min`;
    return `${m} min ${s}`;
  }

  const m = Math.round((total % 3600) / 60);
  // 59 min arrondies à 60 donneraient « 1 h 60 ».
  return m === 60 ? `${h + 1} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** `4:32` — allure en minutes par kilomètre, l'unité de référence de l'app. */
export function formatPace(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  // Une allure au-delà de 30 min/km n'est plus de la course : c'est un arrêt,
  // un signal GPS perdu ou une division par une distance quasi nulle.
  if (secondsPerKm > 30 * 60) return '—';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  // L'arrondi des secondes peut produire 60 : on le reporte sur les minutes.
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

/** `12,4 km` au-delà du kilomètre, `800 m` en dessous. */
export function formatDistance(meters: number, opts?: { forceKm?: boolean }): string {
  if (!Number.isFinite(meters)) return '—';
  if (!opts?.forceKm && meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  const digits = km >= 100 ? 0 : km >= 10 ? 1 : 2;
  return `${km.toFixed(digits).replace('.', ',')} km`;
}

/** Distance nue en kilomètres pour les totaux de semaine : `42,2`. */
export function formatKm(meters: number, digits = 1): string {
  return (meters / 1000).toFixed(digits).replace('.', ',');
}

/** Allure (s/km) ↔ vitesse (km/h). */
export function paceToSpeed(secondsPerKm: number): number {
  return secondsPerKm > 0 ? 3600 / secondsPerKm : 0;
}

export function speedToPace(kmh: number): number {
  return kmh > 0 ? 3600 / kmh : 0;
}

/** Allure lue à voix haute : « 4 minutes 32 » plutôt que « 4 : 32 ». */
export function spokenPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  if (s === 0) return `${m} minutes au kilomètre`;
  return `${m} minutes ${s} au kilomètre`;
}

/** Durée lue à voix haute : « 3 minutes 30 », « 45 secondes ». */
export function spokenDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(h === 1 ? '1 heure' : `${h} heures`);
  if (m > 0) parts.push(m === 1 ? '1 minute' : `${m} minutes`);
  if (s > 0) parts.push(s === 1 ? '1 seconde' : `${s} secondes`);
  return parts.length > 0 ? parts.join(' ') : '0 seconde';
}

/** Distance lue à voix haute : « 400 mètres », « 1,5 kilomètre ». */
export function spokenDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} mètres`;
  const km = meters / 1000;
  const text = km.toFixed(km % 1 === 0 ? 0 : 1).replace('.', ' virgule ');
  return `${text} ${km <= 1 ? 'kilomètre' : 'kilomètres'}`;
}
