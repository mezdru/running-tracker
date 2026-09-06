// Manipulation des dates du plan. Une séance est datée par une CHAÎNE
// `YYYY-MM-DD` et non par un timestamp : le plan est un calendrier, pas une
// chronologie à la seconde. Une clé de jour reste ainsi stable quels que
// soient le fuseau et l'heure d'été — un timestamp, lui, glisse d'un jour à
// l'autre au passage d'un fuseau.
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';

export type DayKey = string; // `YYYY-MM-DD`

/** La semaine commence le lundi : c'est la semaine d'entraînement usuelle. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export function toKey(date: Date): DayKey {
  return format(date, 'yyyy-MM-dd');
}

export function fromKey(key: DayKey): Date {
  // `parseISO` sur une date nue produit minuit LOCAL, ce qu'on veut : les
  // comparaisons de jours se font alors dans le fuseau de l'utilisateur.
  return parseISO(key);
}

export function todayKey(): DayKey {
  return toKey(new Date());
}

/** Lundi de la semaine contenant `date`. */
export function weekStart(date: Date): Date {
  return startOfWeek(date, WEEK_OPTIONS);
}

/** Clé du lundi : identifie une semaine dans les regroupements et les copies. */
export function weekKey(date: Date): DayKey {
  return toKey(weekStart(date));
}

export function addWeeks(date: Date, count: number): Date {
  return addDays(date, count * 7);
}

export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Grille du mois : toujours des semaines complètes du lundi au dimanche, y
 * compris les jours débordant sur les mois voisins. Une grille à trous ferait
 * sauter les colonnes de jours d'une ligne à l'autre.
 */
export function monthGrid(month: Date): Date[][] {
  const first = startOfWeek(startOfMonth(month), WEEK_OPTIONS);
  const lastDay = endOfMonth(month);
  const weeks: Date[][] = [];
  let cursor = first;
  // Au moins jusqu'à couvrir la fin du mois ; la boucle s'arrête sur la
  // semaine qui la contient, donc 4 à 6 lignes selon le mois.
  while (cursor <= lastDay) {
    weeks.push(weekDays(cursor));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function isInMonth(day: Date, month: Date): boolean {
  return isSameMonth(day, month);
}

export function shiftMonth(month: Date, delta: number): Date {
  return addMonths(month, delta);
}

/** Décalage en jours entre deux clés — base des copies de semaine. */
export function dayOffset(from: DayKey, to: DayKey): number {
  return differenceInCalendarDays(fromKey(to), fromKey(from));
}

export function shiftKey(key: DayKey, days: number): DayKey {
  return toKey(addDays(fromKey(key), days));
}

// --- Libellés français ------------------------------------------------------

export function labelDayShort(date: Date): string {
  return format(date, 'EEEEE', { locale: fr }).toUpperCase();
}

export function labelDayFull(date: Date): string {
  return format(date, 'EEEE d MMMM', { locale: fr });
}

export function labelMonth(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: fr });
}

export function labelWeek(monday: Date): string {
  const sunday = addDays(monday, 6);
  const sameMonth = isSameMonth(monday, sunday);
  const left = format(monday, sameMonth ? 'd' : 'd MMM', { locale: fr });
  const right = format(sunday, 'd MMM', { locale: fr });
  return `${left} – ${right}`;
}

export function labelWeekNumber(monday: Date): string {
  return `Semaine ${format(monday, 'I', { locale: fr })}`;
}
