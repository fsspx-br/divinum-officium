import { describe, it, expect } from 'vitest';
import { applyOverrides, type Overrides } from '../src/ui/overrides';
import type { CalendarDay } from '../src/engine/types';

function makeDay(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: '2026-12-25',
    season: 'christmas',
    weekRef: 'Nat',
    celebration: { name: 'In Nativitate Domini', rank: 6, rankName: 'Duplex I classis', source: 'temporal' },
    color: 'white',
    commemorations: [],
    ...overrides,
  };
}

describe('applyOverrides', () => {
  it('supersedes the celebration name when an override exists', () => {
    const ov: Overrides = { en: { 'In Nativitate Domini': 'Christmas Day' } };
    const [day] = applyOverrides([makeDay()], ov, 'en');
    expect(day.celebration.name).toBe('Christmas Day');
  });

  it('falls back to the original name when no override exists', () => {
    const [day] = applyOverrides([makeDay()], { en: {} }, 'en');
    expect(day.celebration.name).toBe('In Nativitate Domini');
  });

  it('isolates overrides per locale', () => {
    const ov: Overrides = { pt: { 'In Nativitate Domini': 'Natal do Senhor' } };
    const [day] = applyOverrides([makeDay()], ov, 'en');
    expect(day.celebration.name).toBe('In Nativitate Domini');
  });

  it('overrides commemoration strings too', () => {
    const ov: Overrides = { en: { 'S. Anastasiae': 'St Anastasia' } };
    const [day] = applyOverrides([makeDay({ commemorations: ['S. Anastasiae', 'Other'] })], ov, 'en');
    expect(day.commemorations).toEqual(['St Anastasia', 'Other']);
  });

  it('does not mutate the input day objects', () => {
    const input = makeDay();
    applyOverrides([input], { en: { 'In Nativitate Domini': 'Christmas Day' } }, 'en');
    expect(input.celebration.name).toBe('In Nativitate Domini');
  });

  it('returns the same array contents when the locale has no map', () => {
    const days = [makeDay()];
    expect(applyOverrides(days, {}, 'en')[0].celebration.name).toBe('In Nativitate Domini');
  });
});

import { buildEditorRows, mergeLocaleOverrides } from '../src/ui/overrides';

describe('buildEditorRows', () => {
  it('dedupes celebration + commemoration names and sorts them', () => {
    const days = [
      makeDay({ celebration: { name: 'Beta', rank: 1, rankName: 'x', source: 'temporal' }, commemorations: ['Alpha'] }),
      makeDay({ celebration: { name: 'Beta', rank: 1, rankName: 'x', source: 'temporal' }, commemorations: ['Gamma'] }),
    ];
    const rows = buildEditorRows(days, {}, 'en');
    expect(rows.map((r) => r.original)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('unions existing override keys not present in the calendar', () => {
    const days = [makeDay({ celebration: { name: 'Beta', rank: 1, rankName: 'x', source: 'temporal' } })];
    const rows = buildEditorRows(days, { en: { Zeta: 'Z!' } }, 'en');
    expect(rows.map((r) => r.original)).toEqual(['Beta', 'Zeta']);
  });

  it('fills custom values from the override map for the locale', () => {
    const days = [makeDay({ celebration: { name: 'Beta', rank: 1, rankName: 'x', source: 'temporal' } })];
    const rows = buildEditorRows(days, { en: { Beta: 'B!' } }, 'en');
    expect(rows.find((r) => r.original === 'Beta')?.custom).toBe('B!');
  });

  it('returns [] for an empty calendar with no overrides', () => {
    expect(buildEditorRows([], {}, 'en')).toEqual([]);
  });
});

describe('mergeLocaleOverrides', () => {
  it('sets the locale map from edits, trimming values', () => {
    const next = mergeLocaleOverrides({}, 'en', { Beta: '  B!  ' });
    expect(next.en).toEqual({ Beta: 'B!' });
  });

  it('drops empty / whitespace-only edits (clears the override)', () => {
    const next = mergeLocaleOverrides({ en: { Beta: 'B!' } }, 'en', { Beta: '   ', Gamma: '' });
    expect(next.en).toEqual({});
  });

  it('does not affect other locales', () => {
    const next = mergeLocaleOverrides({ pt: { Beta: 'Bpt' } }, 'en', { Beta: 'Ben' });
    expect(next.pt).toEqual({ Beta: 'Bpt' });
    expect(next.en).toEqual({ Beta: 'Ben' });
  });
});
