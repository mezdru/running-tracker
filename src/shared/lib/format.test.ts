import {
  formatDistance,
  formatDuration,
  formatDurationShort,
  formatPace,
  spokenDistance,
  spokenDuration,
} from './format';

describe('formatDuration', () => {
  it('omet les heures sous 3600 s', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(204)).toBe('03:24');
  });

  it('affiche les heures au-delà', () => {
    expect(formatDuration(3804)).toBe('1:03:24');
  });
});

describe('formatDurationShort', () => {
  it('reporte 60 minutes arrondies sur l’heure suivante', () => {
    // 1 h 59 min 40 s : les minutes arrondissent à 60 et ne doivent pas
    // s'afficher telles quelles.
    expect(formatDurationShort(3600 + 3580)).toBe('2 h');
  });

  it('formate minutes et heures', () => {
    expect(formatDurationShort(40)).toBe('40 s');
    expect(formatDurationShort(2700)).toBe('45 min');
    expect(formatDurationShort(4320)).toBe('1 h 12');
  });

  it('garde les secondes sur les durées courtes', () => {
    // 90 s et 120 s sont deux raccourcis voisins de l'éditeur : ils ne doivent
    // pas s'afficher tous les deux « 2 min ».
    expect(formatDurationShort(90)).toBe('1 min 30');
    expect(formatDurationShort(120)).toBe('2 min');
    expect(formatDurationShort(45)).toBe('45 s');
  });

  it('arrondit à la minute au-delà de dix minutes', () => {
    expect(formatDurationShort(605)).toBe('10 min');
  });
});

describe('formatPace', () => {
  it('formate une allure classique', () => {
    expect(formatPace(272)).toBe('4:32');
  });

  it('reporte 60 secondes arrondies sur la minute suivante', () => {
    expect(formatPace(299.7)).toBe('5:00');
  });

  it('refuse les allures aberrantes plutôt que d’afficher un nombre faux', () => {
    expect(formatPace(0)).toBe('—');
    expect(formatPace(Infinity)).toBe('—');
    expect(formatPace(3000)).toBe('—');
  });
});

describe('formatDistance', () => {
  it('passe en mètres sous le kilomètre', () => {
    expect(formatDistance(400)).toBe('400 m');
  });

  it('utilise la virgule décimale', () => {
    expect(formatDistance(12400)).toBe('12,4 km');
    expect(formatDistance(1250)).toBe('1,25 km');
  });
});

describe('lecture vocale', () => {
  it('accorde les unités', () => {
    expect(spokenDistance(400)).toBe('400 mètres');
    expect(spokenDistance(1000)).toBe('1 kilomètre');
    expect(spokenDuration(90)).toBe('1 minute 30 secondes');
    expect(spokenDuration(0)).toBe('0 seconde');
  });
});
