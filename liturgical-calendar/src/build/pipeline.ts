/**
 * pipeline.ts — Calendar post-processing pipeline functions
 *
 * Extracted from generate-ics.ts for testability. These functions transform
 * raw CalendarDay arrays by marking holy days, abstinence, and applying
 * locale-specific translations.
 */

import type { CalendarDay } from '../engine/types';

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
 * Mark abstinence days: every Friday + Ash Wednesday + Good Friday,
 * except Fridays that are holy days of obligation (feast overrides abstinence).
 */
export function markAbstinence(days: CalendarDay[]): CalendarDay[] {
  return days.map((day) => {
    const dow = new Date(day.date + 'T12:00:00').getDay();
    const isFriday = dow === 5;
    const isAshWednesday = ASH_WEDNESDAY_PATTERN.test(day.celebration.name);
    const isGoodFriday = GOOD_FRIDAY_PATTERN.test(day.celebration.name);

    // Fridays that are holy days of obligation are exempt from abstinence
    if (isFriday && day.holyDayOfObligation && !isGoodFriday) {
      return day;
    }

    if (isFriday || isAshWednesday || isGoodFriday) {
      return { ...day, abstinence: true };
    }

    return day;
  });
}

// ---------------------------------------------------------------------------
// Portuguese translations
// ---------------------------------------------------------------------------

/** Apply Portuguese translations to celebration names and commemorations. */
export function applyPtTranslations(
  days: CalendarDay[],
  translations: Record<string, string>,
): CalendarDay[] {
  return days.map((day) => ({
    ...day,
    celebration: {
      ...day.celebration,
      name: translations[day.celebration.name] ?? day.celebration.name,
    },
    commemorations: day.commemorations.map(
      (c) => translations[c] ?? c,
    ),
  }));
}
