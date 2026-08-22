/**
 * overrides.ts — Custom day-name override helpers (pure, non-mutating).
 *
 * Overrides are keyed per-locale by the ORIGINAL name string:
 *   displayed = overrides[locale]?.[originalName] ?? originalName
 */

import type { CalendarDay } from '@engine/types';
import type { Locale } from './i18n/i18n';

export type LocaleOverrides = Record<string, string>;
export type Overrides = Partial<Record<Locale, LocaleOverrides>>;

/** Apply per-locale overrides to celebration names and commemorations. */
export function applyOverrides(
  days: CalendarDay[],
  overrides: Overrides,
  locale: Locale,
): CalendarDay[] {
  const map = overrides[locale];
  if (!map) return days;

  return days.map((day) => {
    const name = map[day.celebration.name] ?? day.celebration.name;
    const commemorations = day.commemorations.map((c) => map[c] ?? c);

    const nameChanged = name !== day.celebration.name;
    const commsChanged = commemorations.some((c, i) => c !== day.commemorations[i]);
    if (!nameChanged && !commsChanged) return day;

    return {
      ...day,
      celebration: { ...day.celebration, name },
      commemorations,
    };
  });
}
