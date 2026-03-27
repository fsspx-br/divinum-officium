/**
 * calendar.ts — Top-level LiturgicalCalendar API
 *
 * Integrates Directorium, resolveOccurrence, getLiturgicalColor, and
 * seasonFromWeekRef to produce CalendarDay objects for arbitrary dates.
 */

import type { CalendarDay, CalendarVersion } from './types';
import { Directorium } from './directorium';
import { resolveOccurrence } from './occurrence';
import { getLiturgicalColor } from './color';
import { seasonFromWeekRef } from './date';
import { leapYear } from './date';

// ---------------------------------------------------------------------------
// Days-in-month helper
// ---------------------------------------------------------------------------

/** Returns the number of days in a given month/year. */
function daysInMonth(year: number, month: number): number {
  const months = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (leapYear(year) && month === 2) return 29;
  return months[month];
}

// ---------------------------------------------------------------------------
// LiturgicalCalendar
// ---------------------------------------------------------------------------

export class LiturgicalCalendar {
  private dataDir: string;
  private officeDir: string;
  private fallbackOfficeDir?: string;
  private dir: Directorium;

  constructor(dataDir: string, officeDir: string, fallbackOfficeDir?: string) {
    this.dataDir = dataDir;
    this.officeDir = officeDir;
    this.fallbackOfficeDir = fallbackOfficeDir;
    this.dir = new Directorium(dataDir);
  }

  /**
   * Return the list of available calendar version identifiers.
   */
  getVersions(): string[] {
    return Object.keys(this.dir.getVersionDefs());
  }

  /**
   * Resolve and return a single CalendarDay for the given JS Date and version.
   */
  getCalendarDay(date: Date, version: CalendarVersion): CalendarDay {
    const day = date.getDate();
    const month = date.getMonth() + 1; // JS months are 0-indexed
    const year = date.getFullYear();

    const result = resolveOccurrence(day, month, year, version, this.dir, this.officeDir, this.fallbackOfficeDir);

    const season = seasonFromWeekRef(result.weekRef);

    const color = getLiturgicalColor(
      season,
      result.celebration.name,
      result.celebration.rankName,
      result.celebration.rank,
    );

    // ISO date string: YYYY-MM-DD
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
      date: dateStr,
      season,
      weekRef: result.weekRef,
      celebration: result.celebration,
      color,
      commemorations: result.commemorations,
      transferredFrom: result.transferredFrom,
    };
  }

  /**
   * Return CalendarDay objects for every day in a given month (1-indexed).
   */
  getCalendarMonth(year: number, month: number, version: CalendarVersion): CalendarDay[] {
    const days = daysInMonth(year, month);
    const result: CalendarDay[] = [];

    for (let day = 1; day <= days; day++) {
      result.push(this.getCalendarDay(new Date(year, month - 1, day), version));
    }

    return result;
  }

  /**
   * Return CalendarDay objects for every day in a given year.
   */
  getCalendarYear(year: number, version: CalendarVersion): CalendarDay[] {
    const result: CalendarDay[] = [];

    for (let month = 1; month <= 12; month++) {
      const monthDays = this.getCalendarMonth(year, month, version);
      result.push(...monthDays);
    }

    return result;
  }
}
