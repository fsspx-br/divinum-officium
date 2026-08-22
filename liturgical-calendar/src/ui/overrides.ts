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

export interface EditorRow {
  original: string;
  custom: string;
}

/** Build the sorted, deduped editor row list for a locale. */
export function buildEditorRows(
  days: CalendarDay[],
  overrides: Overrides,
  locale: Locale,
): EditorRow[] {
  const names = new Set<string>();
  for (const day of days) {
    if (day.celebration.name) names.add(day.celebration.name);
    for (const c of day.commemorations) if (c) names.add(c);
  }
  const map = overrides[locale] ?? {};
  for (const key of Object.keys(map)) names.add(key);

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((original) => ({ original, custom: map[original] ?? '' }));
}

/** Replace a locale's override map from editor edits, pruning empty values. */
export function mergeLocaleOverrides(
  overrides: Overrides,
  locale: Locale,
  edits: Record<string, string>,
): Overrides {
  const map: LocaleOverrides = {};
  for (const [original, custom] of Object.entries(edits)) {
    const trimmed = custom.trim();
    if (trimmed) map[original] = trimmed;
  }
  return { ...overrides, [locale]: map };
}
