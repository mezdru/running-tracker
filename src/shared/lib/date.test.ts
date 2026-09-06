import { dayOffset, labelWeek, monthGrid, shiftKey, weekDays, weekKey } from './date';

describe('semaines', () => {
  it('commence le lundi', () => {
    // 2026-09-06 est un dimanche : sa semaine commence le lundi 31 août.
    expect(weekKey(new Date(2026, 8, 6))).toBe('2026-08-31');
  });

  it('rend sept jours consécutifs', () => {
    const days = weekDays(new Date(2026, 7, 31));
    expect(days).toHaveLength(7);
    expect(days[6].getDate()).toBe(6);
  });
});

describe('monthGrid', () => {
  it('ne produit que des lignes de sept jours couvrant tout le mois', () => {
    const grid = monthGrid(new Date(2026, 8, 1));
    expect(grid.every((week) => week.length === 7)).toBe(true);
    const flat = grid.flat().map((d) => d.getTime());
    expect(flat).toContain(new Date(2026, 8, 30).getTime());
  });
});

describe('décalages de dates', () => {
  it('compte les jours entre deux clés', () => {
    expect(dayOffset('2026-09-01', '2026-09-08')).toBe(7);
    expect(dayOffset('2026-09-08', '2026-09-01')).toBe(-7);
  });

  it('traverse un changement de mois', () => {
    expect(shiftKey('2026-08-31', 7)).toBe('2026-09-07');
  });
});

describe('libellés', () => {
  it('abrège le mois quand la semaine est à cheval', () => {
    expect(labelWeek(new Date(2026, 7, 31))).toBe('31 août – 6 sept.');
  });
});
