import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { LiturgicalCalendar } from '@engine/calendar';
import type { CalendarDay } from '@engine/types';

const DATA_DIR = resolve(__dirname, '../data');
const OFFICE_DIR = resolve(__dirname, '../../web/www/horas/Latin');
const VERSION_1960 = 'Rubrics 1960 - 1960';
const VERSION_1570 = 'Tridentine - 1570';

let cal: LiturgicalCalendar;

beforeAll(() => {
  cal = new LiturgicalCalendar(DATA_DIR, OFFICE_DIR);
});

// ---------------------------------------------------------------------------
// getVersions
// ---------------------------------------------------------------------------
describe('getVersions', () => {
  it('returns a non-empty list of versions', () => {
    const versions = cal.getVersions();
    expect(versions.length).toBeGreaterThan(0);
  });

  it('includes Rubrics 1960 version', () => {
    expect(cal.getVersions()).toContain(VERSION_1960);
  });

  it('includes Tridentine 1570 version', () => {
    expect(cal.getVersions()).toContain(VERSION_1570);
  });
});

// ---------------------------------------------------------------------------
// CalendarDay field completeness helper
// ---------------------------------------------------------------------------
function assertCalendarDayFields(day: CalendarDay): void {
  expect(day).toHaveProperty('date');
  expect(day).toHaveProperty('season');
  expect(day).toHaveProperty('weekRef');
  expect(day).toHaveProperty('celebration');
  expect(day).toHaveProperty('color');
  expect(day).toHaveProperty('commemorations');
  expect(typeof day.date).toBe('string');
  expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(typeof day.season).toBe('string');
  expect(typeof day.weekRef).toBe('string');
  expect(typeof day.celebration.name).toBe('string');
  expect(typeof day.celebration.rank).toBe('number');
  expect(typeof day.celebration.rankName).toBe('string');
  expect(['temporal', 'sanctoral']).toContain(day.celebration.source);
  expect(['white', 'red', 'green', 'violet', 'rose', 'black']).toContain(day.color);
  expect(Array.isArray(day.commemorations)).toBe(true);
}

// ---------------------------------------------------------------------------
// getCalendarDay
// ---------------------------------------------------------------------------
describe('getCalendarDay', () => {
  it('returns a well-formed CalendarDay for Easter 2026 (Apr 5)', () => {
    const day = cal.getCalendarDay(new Date(2026, 3, 5), VERSION_1960); // month is 0-indexed in JS
    assertCalendarDayFields(day);
    expect(day.date).toBe('2026-04-05');
    expect(day.season).toBe('easter');
    expect(day.weekRef).toBe('Pasc0');
    expect(day.color).toBe('white');
    expect(day.celebration.rank).toBeGreaterThanOrEqual(7);
  });

  it('returns a well-formed CalendarDay for Christmas 2026 (Dec 25)', () => {
    const day = cal.getCalendarDay(new Date(2026, 11, 25), VERSION_1960);
    assertCalendarDayFields(day);
    expect(day.date).toBe('2026-12-25');
    expect(day.color).toBe('white');
    expect(day.celebration.rank).toBeGreaterThanOrEqual(7);
  });

  it('returns violet for a Lenten feria 2026 (Mar 10)', () => {
    const day = cal.getCalendarDay(new Date(2026, 2, 10), VERSION_1960);
    assertCalendarDayFields(day);
    expect(day.season).toBe('lent');
    expect(day.color).toBe('violet');
  });

  it('returns green for a post-Pentecost Sunday 2026 (Jun 14)', () => {
    const day = cal.getCalendarDay(new Date(2026, 5, 14), VERSION_1960);
    assertCalendarDayFields(day);
    expect(day.season).toBe('pentecost');
    expect(day.color).toBe('green');
  });

  it('resolves St. Joseph 2026 (Mar 19) as sanctoral with correct color', () => {
    const day = cal.getCalendarDay(new Date(2026, 2, 19), VERSION_1960);
    assertCalendarDayFields(day);
    expect(day.celebration.source).toBe('sanctoral');
    // St. Joseph is a confessor/bishop type → white
    expect(day.color).toBe('white');
  });

  it('works for both 1960 and 1570 versions on the same date', () => {
    const day1960 = cal.getCalendarDay(new Date(2026, 3, 5), VERSION_1960);
    const day1570 = cal.getCalendarDay(new Date(2026, 3, 5), VERSION_1570);
    assertCalendarDayFields(day1960);
    assertCalendarDayFields(day1570);
    expect(day1960.date).toBe(day1570.date);
  });
});

// ---------------------------------------------------------------------------
// getCalendarMonth
// ---------------------------------------------------------------------------
describe('getCalendarMonth', () => {
  it('returns 31 days for March 2026', () => {
    const days = cal.getCalendarMonth(2026, 3, VERSION_1960);
    expect(days.length).toBe(31);
  });

  it('returns 28 days for February 2026 (non-leap)', () => {
    const days = cal.getCalendarMonth(2026, 2, VERSION_1960);
    expect(days.length).toBe(28);
  });

  it('returns 29 days for February 2024 (leap year)', () => {
    const days = cal.getCalendarMonth(2024, 2, VERSION_1960);
    expect(days.length).toBe(29);
  });

  it('returns 30 days for April 2026', () => {
    const days = cal.getCalendarMonth(2026, 4, VERSION_1960);
    expect(days.length).toBe(30);
  });

  it('all days in March 2026 have correct fields', () => {
    const days = cal.getCalendarMonth(2026, 3, VERSION_1960);
    for (const day of days) {
      assertCalendarDayFields(day);
    }
  });

  it('days are in sequential order for March 2026', () => {
    const days = cal.getCalendarMonth(2026, 3, VERSION_1960);
    for (let i = 0; i < days.length; i++) {
      expect(days[i].date).toBe(`2026-03-${String(i + 1).padStart(2, '0')}`);
    }
  });
});

// ---------------------------------------------------------------------------
// getCalendarYear
// ---------------------------------------------------------------------------
describe('getCalendarYear', () => {
  it('returns 365 days for 2026 (non-leap)', () => {
    const days = cal.getCalendarYear(2026, VERSION_1960);
    expect(days.length).toBe(365);
  });

  it('returns 366 days for 2024 (leap year)', () => {
    const days = cal.getCalendarYear(2024, VERSION_1960);
    expect(days.length).toBe(366);
  });

  it('every day in 2026 has all required CalendarDay fields', () => {
    const days = cal.getCalendarYear(2026, VERSION_1960);
    for (const day of days) {
      assertCalendarDayFields(day);
    }
  });

  it('year starts on Jan 1 and ends on Dec 31', () => {
    const days = cal.getCalendarYear(2026, VERSION_1960);
    expect(days[0].date).toBe('2026-01-01');
    expect(days[days.length - 1].date).toBe('2026-12-31');
  });

  it('works for 1570 version for entire 2026 year', () => {
    const days = cal.getCalendarYear(2026, VERSION_1570);
    expect(days.length).toBe(365);
    for (const day of days) {
      assertCalendarDayFields(day);
    }
  });

  it('Easter 2026 (Apr 5) appears as white/easter in year array', () => {
    const days = cal.getCalendarYear(2026, VERSION_1960);
    const easter = days.find(d => d.date === '2026-04-05');
    expect(easter).toBeDefined();
    expect(easter!.season).toBe('easter');
    expect(easter!.color).toBe('white');
  });

  it('Christmas 2026 (Dec 25) is white with high rank in year array', () => {
    const days = cal.getCalendarYear(2026, VERSION_1960);
    const christmas = days.find(d => d.date === '2026-12-25');
    expect(christmas).toBeDefined();
    expect(christmas!.color).toBe('white');
    expect(christmas!.celebration.rank).toBeGreaterThanOrEqual(7);
  });
});
