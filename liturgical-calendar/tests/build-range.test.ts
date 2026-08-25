import { describe, expect, it } from 'vitest';
import {
  CALENDAR_START_YEAR,
  CALENDAR_END_YEAR,
  calendarYearRange,
} from '../src/build/range';

describe('long-range calendar build', () => {
  it('covers every year from 2025 through 3000 inclusively', () => {
    const years = calendarYearRange();
    expect(years[0]).toBe(CALENDAR_START_YEAR);
    expect(years.at(-1)).toBe(CALENDAR_END_YEAR);
    expect(years).toHaveLength(976);
    expect(years).toContain(3000);
  });

  it('rejects an inverted or non-integer range', () => {
    expect(() => calendarYearRange(3000, 2025)).toThrow(/Invalid calendar year range/);
    expect(() => calendarYearRange(2025.5, 3000)).toThrow(/Invalid calendar year range/);
  });
});
