/**
 * date.ts — Faithful TypeScript port of DivinumOfficium/Date.pm
 *
 * Exports:
 *   leapYear, dateToYdays, ydaysToDate, dayOfWeek,
 *   getEaster, getAdvent, getSday, nextday, getWeek, seasonFromWeekRef
 */

import type { Season } from './types';

// Cumulative days before the start of each month (1-indexed, index 0 unused)
// i.e. MONTHSUP[m-1] = days before month m in a non-leap year
const MONTHSUP = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/**
 * Gregorian leap year check.
 * Returns true if year is a leap year.
 */
export function leapYear(year: number): boolean {
  // Perl: !(($year % 4) or !($year % 100) and ($year % 400))
  // Equivalent: divisible by 4, except centuries unless also divisible by 400
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Convert day/month/year to day-of-year (1 = Jan 1).
 * Perl: $MONTHSUP[$month - 1] + $day + ($month > 2) * leapyear($year)
 */
export function dateToYdays(day: number, month: number, year: number): number {
  return MONTHSUP[month - 1] + day + (month > 2 ? (leapYear(year) ? 1 : 0) : 0);
}

/**
 * Convert day-of-year back to {day, month, year}.
 * Perl returns ($day, $month, $year); we return an object.
 */
export function ydaysToDate(days: number, year: number): { day: number; month: number; year: number } {
  const months = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (leapYear(year)) {
    months[2]++;
  }

  let month = 1;
  let day = days;

  while (day > months[month] && month < 13) {
    day -= months[month];
    month++;
  }

  return { day, month, year };
}

/**
 * Day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 * Perl:
 *   ($year * 365 + int(($year-1)/4) - int(($year-1)/100) + int(($year-1)/400)
 *    - 1 + date_to_ydays(@_)) % 7
 */
export function dayOfWeek(day: number, month: number, year: number): number {
  const yd = dateToYdays(day, month, year);
  return (
    (year * 365 +
      Math.floor((year - 1) / 4) -
      Math.floor((year - 1) / 100) +
      Math.floor((year - 1) / 400) -
      1 +
      yd) %
    7
  );
}

/**
 * Compute Easter Sunday for a given year using the Meeus/Jones/Butcher algorithm.
 * Faithful port of Date.pm's geteaster().
 * Returns {day, month, year}.
 */
export function getEaster(year: number): { day: number; month: number; year: number } {
  const G = year % 19;
  const C = Math.floor(year / 100);
  const H =
    (C - Math.floor(C / 4) - Math.floor((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I =
    H -
    Math.floor(H / 28) *
      (1 -
        Math.floor(H / 28) *
          Math.floor(29 / (H + 1)) *
          Math.floor((21 - G) / 11));
  const J = (year + Math.floor(year / 4) + I + 2 - C + Math.floor(C / 4)) % 7;
  const L = I - J;
  const month = 3 + Math.floor((L + 40) / 44);
  const day = L + 28 - 31 * Math.floor(month / 4);
  return { day, month, year };
}

/**
 * First Sunday of Advent as day-of-year number.
 * Perl:
 *   my $christmas_dow = day_of_week(25, 12, $year) || 7;
 *   return $christmas - $christmas_dow - 21;
 */
export function getAdvent(year: number): number {
  const christmas = dateToYdays(25, 12, year);
  const christmasDow = dayOfWeek(25, 12, year) || 7; // treat Sunday(0) as 7
  return christmas - christmasDow - 21;
}

/**
 * Get sanctoral reference string (mm-dd) for a date, with leap year adjustment.
 *
 * In a leap year, Feb 24 is reassigned to Feb 29 (the leap day office),
 * and dates Feb 25-29 are shifted back by one day.
 */
export function getSday(month: number, day: number, year: number): string {
  let d = day;
  if (leapYear(year) && month === 2) {
    if (d === 24) {
      d = 29;
    } else if (d > 24) {
      d -= 1;
    }
  }
  return `${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Return the sanctoral reference for the next day.
 * Wraps to Jan 1 of the next year at year-end.
 * Perl: nextday($month, $day, $year)
 */
export function nextday(month: number, day: number, year: number): string {
  const time = dateToYdays(day, month, year) + 1;

  if (time > 365 && (!leapYear(year) || time === 367)) {
    return getSday(1, 1, year + 1);
  } else {
    const d = ydaysToDate(time, year);
    return getSday(d.month, d.day, d.year);
  }
}

/**
 * Return the liturgical week identifier for a given date.
 *
 * Parameters match Perl's getweek($day, $month, $year, $tomorrow, $missa).
 *
 * Season codes returned:
 *   Adv1..4     — Advent
 *   NatDD       — Christmas / Christmas octave (DD = day of month)
 *   EpiN        — Epiphany season
 *   Quadp1..3   — Septuagesima, Sexagesima, Quinquagesima
 *   Quad1..6    — Lent weeks
 *   Pasc0..7    — Paschal / Easter weeks (0 = Easter Sunday week)
 *   Pent01..24  — Sundays after Pentecost
 *   EpiN        — Epiphany Sundays resumed after Pentecost (office)
 *   PentEpiN    — Epiphany Sundays resumed after Pentecost (missa)
 */
export function getWeek(
  day: number,
  month: number,
  year: number,
  tomorrow?: boolean,
  missa?: boolean,
): string {
  let t = dateToYdays(day, month, year);
  if (tomorrow) t++;

  const tDay = tomorrow ? day + 1 : day;

  const advent1 = getAdvent(year);
  const christmas = dateToYdays(25, 12, year);

  // Advent / Christmas in December
  if (t >= advent1) {
    if (t < christmas) {
      const n = 1 + Math.floor((t - advent1) / 7);
      // Perl: if ($month == 11 || $day < 25) { return "Adv$n"; }
      if (month === 11 || day < 25) {
        return `Adv${n}`;
      }
    }
    return `Nat${tDay}`;
  }

  // Christmas season in January (before Epiphany Ordinary time begins)
  // ordtime = day-of-year for the Sunday after Jan 6
  const ordtime = 6 + 7 - dayOfWeek(6, 1, year);

  if (month === 1 && t < ordtime) {
    return `Nat${String(tDay).padStart(2, '0')}`;
  }

  // Compute Easter as day-of-year
  const easterDate = getEaster(year);
  const easter = dateToYdays(easterDate.day, easterDate.month, easterDate.year);

  // Epiphany season
  if (t < easter - 63) {
    const n = Math.floor((t - ordtime) / 7) + 1;
    return `Epi${n}`;
  }

  // Septuagesima, Sexagesima, Quinquagesima
  if (t < easter - 56) return 'Quadp1';
  if (t < easter - 49) return 'Quadp2';
  if (t < easter - 42) return 'Quadp3';

  // Lent (Quadragesima)
  if (t < easter) {
    const n = 1 + Math.floor((t - (easter - 42)) / 7);
    return `Quad${n}`;
  }

  // Paschal time (Easter + 56 days = up to and including the week of Pentecost Sunday)
  if (t < easter + 56) {
    const n = Math.floor((t - easter) / 7);
    return `Pasc${n}`;
  }

  // Pentecost season
  let n = Math.floor((t - (easter + 49)) / 7);

  if (n < 23) {
    return `Pent${String(n).padStart(2, '0')}`;
  }

  const wdist = Math.floor((advent1 - t + 6) / 7);

  if (wdist < 2) return 'Pent24';
  if (n === 23) return 'Pent23';

  if (missa) {
    return `PentEpi${8 - wdist}`;
  } else {
    return `Epi${8 - wdist}`;
  }
}

/**
 * Derive a Season from a weekRef code returned by getWeek().
 */
export function seasonFromWeekRef(weekRef: string): Season {
  if (weekRef.startsWith('Adv')) return 'advent';
  if (weekRef.startsWith('Nat')) return 'christmas';
  if (weekRef.startsWith('PentEpi')) return 'epiphany';
  if (weekRef.startsWith('Epi')) return 'epiphany';
  if (weekRef.startsWith('Quadp')) return 'septuagesima';
  if (weekRef.startsWith('Quad')) return 'lent';
  if (weekRef.startsWith('Pasc')) return 'easter';
  if (weekRef.startsWith('Pent')) return 'pentecost';
  // fallback
  return 'pentecost';
}
