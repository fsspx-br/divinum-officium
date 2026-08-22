/**
 * pipeline.test.ts — Tests for calendar post-processing pipeline
 *
 * Unit tests for markHolyDays, markAbstinence, and applyPtTranslations.
 */

import { describe, it, expect } from 'vitest';
import {
  markHolyDays,
  markAbstinence,
  applyPtTranslations,
} from '../src/build/pipeline';
import type { HolyDaysConfig } from '../src/build/pipeline';
import type { CalendarDay } from '../src/engine/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDay(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: '2026-03-02', // Monday
    season: 'lent',
    weekRef: 'Quad1-1',
    celebration: {
      name: 'Feria II',
      rank: 1,
      rankName: 'Feria',
      source: 'temporal',
    },
    color: 'violet',
    commemorations: [],
    ...overrides,
  };
}

const HOLY_DAYS_CONFIG: HolyDaysConfig = {
  universal: [
    { date: '12-25', key: 'nativity' },
    { date: '01-01', key: 'circumcision' },
    { date: '01-06', key: 'epiphany' },
    { date: 'ascension', key: 'ascension' },
    { date: 'corpus-christi', key: 'corpus_christi' },
    { date: '12-08', key: 'immaculate_conception' },
    { date: '08-15', key: 'assumption' },
    { date: '03-19', key: 'st_joseph' },
    { date: '06-29', key: 'sts_peter_paul' },
    { date: '11-01', key: 'all_saints' },
  ],
  brazil: [
    { date: '10-12', key: 'our_lady_aparecida' },
  ],
};

// ---------------------------------------------------------------------------
// markHolyDays
// ---------------------------------------------------------------------------

describe('markHolyDays', () => {
  it('marks Sundays as holy days', () => {
    // 2026-03-01 is a Sunday
    const days = [makeDay({ date: '2026-03-01' })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBe(true);
  });

  it('does not mark ordinary weekdays as holy days', () => {
    // 2026-03-02 is a Monday
    const days = [makeDay({ date: '2026-03-02' })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBeUndefined();
  });

  it('marks Christmas (Dec 25) as a holy day', () => {
    const days = [makeDay({ date: '2026-12-25' })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBe(true);
  });

  it('marks Circumcision (Jan 1) as a holy day', () => {
    const days = [makeDay({ date: '2026-01-01' })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBe(true);
  });

  it('marks Epiphany (Jan 6) as a holy day', () => {
    const days = [makeDay({ date: '2026-01-06' })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBe(true);
  });

  it('marks Immaculate Conception (Dec 8) as a holy day', () => {
    const days = [makeDay({ date: '2026-12-08' })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBe(true);
  });

  it('marks Assumption (Aug 15) as a holy day', () => {
    const days = [makeDay({ date: '2026-08-15' })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBe(true);
  });

  it('marks St. Joseph (Mar 19) as a holy day', () => {
    const days = [makeDay({ date: '2026-03-19' })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBe(true);
  });

  it('marks Sts. Peter and Paul (Jun 29) as a holy day', () => {
    const days = [makeDay({ date: '2026-06-29' })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBe(true);
  });

  it('marks All Saints (Nov 1) as a holy day', () => {
    const days = [makeDay({ date: '2026-11-01' })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBe(true);
  });

  it('marks Ascension by celebration name (moveable feast)', () => {
    const days = [makeDay({
      date: '2026-05-14', // Thursday
      celebration: { name: 'In Ascensione Domini', rank: 6, rankName: 'Duplex I classis', source: 'temporal' },
    })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBe(true);
  });

  it('marks Corpus Christi by celebration name (moveable feast)', () => {
    const days = [makeDay({
      date: '2026-06-04', // Thursday
      celebration: { name: 'Festum Sanctissimi Corporis Christi', rank: 6, rankName: 'Duplex I classis', source: 'temporal' },
    })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(result[0].holyDayOfObligation).toBe(true);
  });

  it('includes regional holy days when region is specified', () => {
    // Oct 12 = Our Lady of Aparecida (Brazil)
    const days = [makeDay({ date: '2026-10-12' })];

    const withoutRegion = markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(withoutRegion[0].holyDayOfObligation).toBeUndefined();

    const withRegion = markHolyDays(days, HOLY_DAYS_CONFIG, ['brazil']);
    expect(withRegion[0].holyDayOfObligation).toBe(true);
  });

  it('ignores unknown regions gracefully', () => {
    const days = [makeDay({ date: '2026-03-02' })];
    const result = markHolyDays(days, HOLY_DAYS_CONFIG, ['unknown_region']);
    expect(result[0].holyDayOfObligation).toBeUndefined();
  });

  it('does not mutate original days', () => {
    const days = [makeDay({ date: '2026-12-25' })];
    markHolyDays(days, HOLY_DAYS_CONFIG);
    expect(days[0].holyDayOfObligation).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// markAbstinence
// ---------------------------------------------------------------------------

describe('markAbstinence', () => {
  it('marks Fridays as abstinence days', () => {
    // 2026-03-06 is a Friday
    const days = [makeDay({ date: '2026-03-06' })];
    const result = markAbstinence(days);
    expect(result[0].abstinence).toBe(true);
  });

  it('does not mark non-Fridays as abstinence', () => {
    // 2026-03-02 is a Monday
    const days = [makeDay({ date: '2026-03-02' })];
    const result = markAbstinence(days);
    expect(result[0].abstinence).toBeUndefined();
  });

  it('marks Ash Wednesday (Feria IV Cinerum) as abstinence', () => {
    const days = [makeDay({
      date: '2026-02-18', // Wednesday
      celebration: { name: 'Feria IV Cinerum', rank: 6, rankName: 'Feria privilegiata', source: 'temporal' },
    })];
    const result = markAbstinence(days);
    expect(result[0].abstinence).toBe(true);
  });

  it('marks Good Friday (Parasceve) as abstinence', () => {
    const days = [makeDay({
      date: '2026-04-03', // Friday
      celebration: { name: 'Feria VI in Parasceve', rank: 6, rankName: 'Feria privilegiata', source: 'temporal' },
    })];
    const result = markAbstinence(days);
    expect(result[0].abstinence).toBe(true);
  });

  it('exempts Fridays that are holy days of obligation', () => {
    // A Friday that is also a holy day (e.g. Christmas on a Friday)
    const days = [makeDay({
      date: '2026-12-25', // not actually a Friday in 2026, but let's simulate
      holyDayOfObligation: true,
    })];
    // Find a year where Dec 25 is Friday: 2026-03-06 is Friday, use that
    const fridayHolyDay = makeDay({
      date: '2026-03-06', // Friday
      holyDayOfObligation: true,
      celebration: { name: 'Some Feast', rank: 6, rankName: 'Duplex I classis', source: 'sanctoral' },
    });
    const result = markAbstinence([fridayHolyDay]);
    expect(result[0].abstinence).toBeUndefined();
  });

  it('does NOT exempt Good Friday even if marked as holy day', () => {
    const goodFriday = makeDay({
      date: '2026-04-03', // Friday
      holyDayOfObligation: true,
      celebration: { name: 'Feria VI in Parasceve', rank: 6, rankName: 'Feria privilegiata', source: 'temporal' },
    });
    const result = markAbstinence([goodFriday]);
    expect(result[0].abstinence).toBe(true);
  });

  it('does not mutate original days', () => {
    const days = [makeDay({ date: '2026-03-06' })]; // Friday
    markAbstinence(days);
    expect(days[0].abstinence).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// applyPtTranslations
// ---------------------------------------------------------------------------

describe('applyPtTranslations', () => {
  const translations: Record<string, string> = {
    'Feria II': 'Segunda-feira',
    'St. Joseph': 'São José',
    'St. Anne': 'Santa Ana',
  };

  it('translates celebration name when translation exists', () => {
    const days = [makeDay({ celebration: { name: 'Feria II', rank: 1, rankName: 'Feria', source: 'temporal' } })];
    const result = applyPtTranslations(days, translations);
    expect(result[0].celebration.name).toBe('Segunda-feira');
  });

  it('keeps original name when no translation exists', () => {
    const days = [makeDay({ celebration: { name: 'Unknown Feast', rank: 3, rankName: 'Duplex', source: 'sanctoral' } })];
    const result = applyPtTranslations(days, translations);
    expect(result[0].celebration.name).toBe('Unknown Feast');
  });

  it('translates commemorations', () => {
    const days = [makeDay({ commemorations: ['St. Joseph', 'St. Anne'] })];
    const result = applyPtTranslations(days, translations);
    expect(result[0].commemorations).toEqual(['São José', 'Santa Ana']);
  });

  it('keeps untranslated commemorations as-is', () => {
    const days = [makeDay({ commemorations: ['St. Joseph', 'Unknown Saint'] })];
    const result = applyPtTranslations(days, translations);
    expect(result[0].commemorations).toEqual(['São José', 'Unknown Saint']);
  });

  it('does not mutate original days', () => {
    const days = [makeDay({ celebration: { name: 'Feria II', rank: 1, rankName: 'Feria', source: 'temporal' } })];
    applyPtTranslations(days, translations);
    expect(days[0].celebration.name).toBe('Feria II');
  });

  it('preserves all other CalendarDay fields', () => {
    const original = makeDay({
      date: '2026-03-02',
      season: 'lent',
      color: 'violet',
      celebration: { name: 'Feria II', rank: 1, rankName: 'Feria', source: 'temporal' },
    });
    const result = applyPtTranslations([original], translations);
    expect(result[0].date).toBe('2026-03-02');
    expect(result[0].season).toBe('lent');
    expect(result[0].color).toBe('violet');
    expect(result[0].celebration.rank).toBe(1);
    expect(result[0].celebration.rankName).toBe('Feria');
  });
});
