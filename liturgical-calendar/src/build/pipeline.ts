/**
 * pipeline.ts — Calendar post-processing pipeline functions
 *
 * Extracted from generate-ics.ts for testability. These functions transform
 * raw CalendarDay arrays by marking holy days, abstinence, and applying
 * locale-specific translations.
 */

import type { CalendarDay } from '../engine/types';
import { getAdvent, getEaster, ydaysToDate } from '../engine/date';

// ---------------------------------------------------------------------------
// Holy days of obligation
// ---------------------------------------------------------------------------

export interface HolyDayEntry {
  date: string;  // MM-DD for fixed, or keyword for moveable
  key: string;
}

export interface HolyDaysConfig {
  universal: HolyDayEntry[];
  [region: string]: HolyDayEntry[];
}

/** Name patterns for moveable feasts (key = date field from holy-days.json). */
export const MOVEABLE_FEAST_PATTERNS: Record<string, RegExp> = {
  'ascension': /^in ascensione domini$/i,
  'corpus-christi': /^festum sanctissimi corporis christi$/i,
};

/**
 * Mark holy days of obligation on CalendarDay objects.
 * Uses fixed dates from the config + name matching for moveable feasts.
 */
export function markHolyDays(
  days: CalendarDay[],
  config: HolyDaysConfig,
  regions: string[] = [],
): CalendarDay[] {
  // Collect all applicable entries: universal + selected regions
  const entries: HolyDayEntry[] = [
    ...config.universal,
    ...regions.flatMap((r) => config[r] ?? []),
  ];

  // Build set of fixed MM-DD dates
  const fixedDates = new Set<string>();
  const moveableKeys: string[] = [];
  for (const entry of entries) {
    if (/^\d{2}-\d{2}$/.test(entry.date)) {
      fixedDates.add(entry.date);
    } else {
      moveableKeys.push(entry.date);
    }
  }

  return days.map((day) => {
    const mmdd = day.date.slice(5); // "YYYY-MM-DD" → "MM-DD"
    const isSunday = new Date(day.date + 'T12:00:00').getDay() === 0;

    let isHolyDay = isSunday || fixedDates.has(mmdd);

    if (!isHolyDay) {
      for (const key of moveableKeys) {
        const pattern = MOVEABLE_FEAST_PATTERNS[key];
        if (pattern && pattern.test(day.celebration.name)) {
          isHolyDay = true;
          break;
        }
      }
    }

    return isHolyDay ? { ...day, holyDayOfObligation: true } : day;
  });
}

// ---------------------------------------------------------------------------
// Abstinence days
// ---------------------------------------------------------------------------

/** Celebration name patterns for Ash Wednesday and Good Friday. */
export const ASH_WEDNESDAY_PATTERN = /cinerum|cinzas/i;
export const GOOD_FRIDAY_PATTERN = /parasceve|sexta.feira santa/i;

/**
 * Mark abstinence days: every Friday + Ash Wednesday + Good Friday + Ember Days,
 * except Fridays that are holy days of obligation (feast overrides abstinence).
 */
export function markAbstinence(days: CalendarDay[]): CalendarDay[] {
  return days.map((day) => {
    const dow = new Date(day.date + 'T12:00:00').getDay();
    const isFriday = dow === 5;
    const isAshWednesday = ASH_WEDNESDAY_PATTERN.test(day.celebration.name);
    const isGoodFriday = GOOD_FRIDAY_PATTERN.test(day.celebration.name);

    // Fridays that are holy days of obligation are exempt from abstinence
    if (isFriday && day.holyDayOfObligation && !isGoodFriday && !day.isEmberDay) {
      return day;
    }

    if (isFriday || isAshWednesday || isGoodFriday || day.isEmberDay) {
      return { ...day, abstinence: true };
    }

    return day;
  });
}

// ---------------------------------------------------------------------------
// Ember Days (Têmporas)
// ---------------------------------------------------------------------------

const EMBER_WEEKDAY_OFFSETS = [3, 5, 6]; // Wednesday, Friday, Saturday after Sunday

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function firstSundayOfMonth(year: number, month: number): Date {
  const first = utcDate(year, month, 1);
  return addUtcDays(first, (7 - first.getUTCDay()) % 7);
}

function usesReformedSeptemberRule(version: string): boolean {
  if (/newcal/i.test(version)) return true;
  const rubricYear = Number(version.match(/\b(\d{4})\b/)?.[1] ?? 0);
  return rubricYear >= 1960;
}

/** Return all twelve Ember Day dates for a civil year. */
export function getEmberDays(
  year: number,
  version: string = 'Rubrics 1960 - 1960',
): string[] {
  const easterParts = getEaster(year);
  const easter = utcDate(easterParts.year, easterParts.month, easterParts.day);
  const adventParts = ydaysToDate(getAdvent(year), year);
  const firstAdventSunday = utcDate(adventParts.year, adventParts.month, adventParts.day);

  const sundayAnchors = [
    addUtcDays(easter, -42),       // First Sunday of Lent
    addUtcDays(easter, 49),        // Pentecost
    addUtcDays(firstAdventSunday, 14), // Third Sunday of Advent
  ];

  const dates = sundayAnchors.flatMap((anchor) =>
    EMBER_WEEKDAY_OFFSETS.map((offset) => toIsoDate(addUtcDays(anchor, offset))),
  );

  if (usesReformedSeptemberRule(version)) {
    const thirdSeptemberSunday = addUtcDays(firstSundayOfMonth(year, 9), 14);
    dates.push(...EMBER_WEEKDAY_OFFSETS.map(
      (offset) => toIsoDate(addUtcDays(thirdSeptemberSunday, offset)),
    ));
  } else {
    const holyCross = utcDate(year, 9, 14);
    const daysUntilWednesday = ((3 - holyCross.getUTCDay() + 7) % 7) || 7;
    const emberWednesday = addUtcDays(holyCross, daysUntilWednesday);
    dates.push(
      toIsoDate(emberWednesday),
      toIsoDate(addUtcDays(emberWednesday, 2)),
      toIsoDate(addUtcDays(emberWednesday, 3)),
    );
  }

  return dates.sort();
}

/** Determine whether an ISO civil date is an Ember Day. */
export function isEmberDay(
  date: string,
  version: string = 'Rubrics 1960 - 1960',
): boolean {
  const year = Number(date.match(/^(\d{4})-\d{2}-\d{2}$/)?.[1]);
  return Number.isInteger(year) && getEmberDays(year, version).includes(date);
}

/** Mark Ember Days without relying on localized celebration names. */
export function markEmberDays(
  days: CalendarDay[],
  version: string = 'Rubrics 1960 - 1960',
): CalendarDay[] {
  return days.map((day) => (
    isEmberDay(day.date, version) ? { ...day, isEmberDay: true } : day
  ));
}

// ---------------------------------------------------------------------------
// Portuguese translations
// ---------------------------------------------------------------------------

function normalizeLatinTranslationKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/æ/giu, 'ae')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/giu, '')
    .toLowerCase();
}

/** Apply Portuguese translations to celebration names and commemorations. */
export function applyPtTranslations(
  days: CalendarDay[],
  translations: Record<string, string>,
): CalendarDay[] {
  const normalizedTranslations = new Map<string, string>();
  for (const [latin, portuguese] of Object.entries(translations)) {
    const key = normalizeLatinTranslationKey(latin);
    if (!normalizedTranslations.has(key)) normalizedTranslations.set(key, portuguese);
  }

  const translate = (name: string): string =>
    translations[name]
    ?? normalizedTranslations.get(normalizeLatinTranslationKey(name))
    ?? (/^Feria\b/iu.test(name) ? 'Féria' : name);

  return days.map((day) => ({
    ...day,
    celebration: {
      ...day.celebration,
      name: translate(day.celebration.name),
    },
    commemorations: day.commemorations.map(translate),
  }));
}

/** Apply exact-date Portuguese labels from an external calendar reference. */
export function applyPtDateTranslations(
  days: CalendarDay[],
  dateTranslations: Record<string, string>,
): CalendarDay[] {
  return days.map((day) => {
    const name = dateTranslations[day.date];
    if (!name || name === day.celebration.name) return day;
    return { ...day, celebration: { ...day.celebration, name } };
  });
}
