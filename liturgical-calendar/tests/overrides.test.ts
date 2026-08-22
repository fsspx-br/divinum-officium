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
