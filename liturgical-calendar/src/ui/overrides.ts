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
  /** Latin name shown in the "Original name" column. */
  original: string;
  /** Built-in locale translation and persisted override key. */
  key: string;
  /** Effective translated value shown in the editor. */
  custom: string;
}

/** Build the sorted, deduped editor row list, displaying Latin source names. */
export function buildEditorRows(
  days: CalendarDay[],
  latinDays: CalendarDay[],
  overrides: Overrides,
  locale: Locale,
): EditorRow[] {
  const names = new Map<string, string>();
  const latinByDate = new Map(latinDays.map((day) => [day.date, day]));

  for (const [dayIndex, day] of days.entries()) {
    const pairedDay = latinDays[dayIndex];
    const latinDay = pairedDay?.date === day.date ? pairedDay : latinByDate.get(day.date);
    if (day.celebration.name) {
      names.set(day.celebration.name, latinDay?.celebration.name ?? day.celebration.name);
    }
    for (const [index, name] of day.commemorations.entries()) {
      if (name) names.set(name, latinDay?.commemorations[index] ?? name);
    }
  }

  const map = overrides[locale] ?? {};
  for (const key of Object.keys(map)) {
    if (!names.has(key)) names.set(key, key);
  }

  return [...names]
    .map(([key, original]) => ({ original, key, custom: map[key] ?? key }))
    .sort((a, b) => a.original.localeCompare(b.original));
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
