import { describe, it, expect } from 'vitest';
import {
  leapYear,
  dateToYdays,
  ydaysToDate,
  dayOfWeek,
  getEaster,
  getAdvent,
  getSday,
  nextday,
  getWeek,
  seasonFromWeekRef,
} from '@engine/date';

describe('leapYear', () => {
  it('2024 is a leap year', () => expect(leapYear(2024)).toBe(true));
  it('2000 is a leap year', () => expect(leapYear(2000)).toBe(true));
  it('2023 is not a leap year', () => expect(leapYear(2023)).toBe(false));
  it('1900 is not a leap year', () => expect(leapYear(1900)).toBe(false));
  it('1996 is a leap year', () => expect(leapYear(1996)).toBe(true));
  it('1800 is not a leap year', () => expect(leapYear(1800)).toBe(false));
});

describe('dateToYdays', () => {
  it('Jan 1 is day 1', () => expect(dateToYdays(1, 1, 2023)).toBe(1));
  it('Dec 31 non-leap is day 365', () => expect(dateToYdays(31, 12, 2023)).toBe(365));
  it('Dec 31 leap is day 366', () => expect(dateToYdays(31, 12, 2024)).toBe(366));
  it('Mar 1 non-leap is day 60', () => expect(dateToYdays(1, 3, 2023)).toBe(60));
  it('Mar 1 leap is day 61', () => expect(dateToYdays(1, 3, 2024)).toBe(61));
  it('Feb 28 non-leap is day 59', () => expect(dateToYdays(28, 2, 2023)).toBe(59));
  it('Feb 29 leap is day 60', () => expect(dateToYdays(29, 2, 2024)).toBe(60));
});

describe('ydaysToDate', () => {
  it('day 1 in 2023 is Jan 1', () => {
    const result = ydaysToDate(1, 2023);
    expect(result).toEqual({ day: 1, month: 1, year: 2023 });
  });
  it('day 365 in 2023 is Dec 31', () => {
    const result = ydaysToDate(365, 2023);
    expect(result).toEqual({ day: 31, month: 12, year: 2023 });
  });
  it('day 366 in 2024 (leap) is Dec 31', () => {
    const result = ydaysToDate(366, 2024);
    expect(result).toEqual({ day: 31, month: 12, year: 2024 });
  });
  it('day 60 in 2024 (leap) is Feb 29', () => {
    const result = ydaysToDate(60, 2024);
    expect(result).toEqual({ day: 29, month: 2, year: 2024 });
  });
  it('roundtrip: dateToYdays -> ydaysToDate', () => {
    const ydays = dateToYdays(15, 6, 2025);
    const result = ydaysToDate(ydays, 2025);
    expect(result).toEqual({ day: 15, month: 6, year: 2025 });
  });
  it('roundtrip leap year: Mar 10 2024', () => {
    const ydays = dateToYdays(10, 3, 2024);
    const result = ydaysToDate(ydays, 2024);
    expect(result).toEqual({ day: 10, month: 3, year: 2024 });
  });
});

describe('dayOfWeek', () => {
  // 2026-03-01 is a Sunday (0)
  it('2026-03-01 is Sunday (0)', () => expect(dayOfWeek(1, 3, 2026)).toBe(0));
  // 2026-01-01 is a Thursday (4)
  it('2026-01-01 is Thursday (4)', () => expect(dayOfWeek(1, 1, 2026)).toBe(4));
  // 2024-03-31 is a Sunday (Easter 2024)
  it('2024-03-31 is Sunday (0)', () => expect(dayOfWeek(31, 3, 2024)).toBe(0));
  // 2025-04-20 is a Sunday (Easter 2025)
  it('2025-04-20 is Sunday (0)', () => expect(dayOfWeek(20, 4, 2025)).toBe(0));
  // 2000-01-01 is a Saturday (6)
  it('2000-01-01 is Saturday (6)', () => expect(dayOfWeek(1, 1, 2000)).toBe(6));
});

describe('getEaster', () => {
  it('2024: March 31', () => {
    const e = getEaster(2024);
    expect(e).toEqual({ day: 31, month: 3, year: 2024 });
  });
  it('2025: April 20', () => {
    const e = getEaster(2025);
    expect(e).toEqual({ day: 20, month: 4, year: 2025 });
  });
  it('2026: April 5', () => {
    const e = getEaster(2026);
    expect(e).toEqual({ day: 5, month: 4, year: 2026 });
  });
  it('1818: March 22 (earliest possible)', () => {
    const e = getEaster(1818);
    expect(e).toEqual({ day: 22, month: 3, year: 1818 });
  });
  it('1943: April 25 (latest possible)', () => {
    const e = getEaster(1943);
    expect(e).toEqual({ day: 25, month: 4, year: 1943 });
  });
});

describe('getAdvent', () => {
  // For 2026: Christmas is Dec 25 (Friday, DOW=5)
  // christmas_dow = 5 (or treat as 5)
  // advent1 = christmas_ydays - 5 - 21 = 359 - 5 - 21 = 333
  // Day 333 in 2026: Nov 29
  it('2026: first Sunday of Advent is Nov 29', () => {
    const advent = getAdvent(2026);
    const d = ydaysToDate(advent, 2026);
    expect(d).toEqual({ day: 29, month: 11, year: 2026 });
    // Also verify it's a Sunday
    expect(dayOfWeek(d.day, d.month, 2026)).toBe(0);
  });

  it('2025: first Sunday of Advent is Nov 30', () => {
    const advent = getAdvent(2025);
    const d = ydaysToDate(advent, 2025);
    expect(d).toEqual({ day: 30, month: 11, year: 2025 });
    expect(dayOfWeek(d.day, d.month, 2025)).toBe(0);
  });

  it('getAdvent result is always a Sunday', () => {
    for (const year of [2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
      const advent = getAdvent(year);
      const d = ydaysToDate(advent, year);
      expect(dayOfWeek(d.day, d.month, year)).toBe(0);
    }
  });
});

describe('getSday', () => {
  it('normal date: Apr 15', () => expect(getSday(4, 15, 2025)).toBe('04-15'));
  it('normal date: Dec 25', () => expect(getSday(12, 25, 2025)).toBe('12-25'));
  it('non-leap Feb 24 stays 02-24', () => expect(getSday(2, 24, 2023)).toBe('02-24'));
  it('non-leap Feb 25 stays 02-25', () => expect(getSday(2, 25, 2023)).toBe('02-25'));
  // Leap year adjustments
  it('leap Feb 24 becomes 02-29 (the leap day)', () => expect(getSday(2, 24, 2024)).toBe('02-29'));
  it('leap Feb 25 becomes 02-24 (shifted back one)', () => expect(getSday(2, 25, 2024)).toBe('02-24'));
  it('leap Feb 26 becomes 02-25', () => expect(getSday(2, 26, 2024)).toBe('02-25'));
  it('leap Feb 28 becomes 02-27', () => expect(getSday(2, 28, 2024)).toBe('02-27'));
  it('leap Feb 29 becomes 02-28', () => expect(getSday(2, 29, 2024)).toBe('02-28'));
  it('leap Mar 1 unchanged', () => expect(getSday(3, 1, 2024)).toBe('03-01'));
});

describe('nextday', () => {
  it('Jan 31 -> Feb 01', () => expect(nextday(1, 31, 2025)).toBe('02-01'));
  it('Dec 31 -> Jan 01 (wraps to next year, returns "01-01")', () => {
    // nextday wraps to next year, calling getSday(1,1,year+1)
    expect(nextday(12, 31, 2025)).toBe('01-01');
  });
  it('Feb 28 non-leap -> Mar 01', () => expect(nextday(2, 28, 2023)).toBe('03-01'));
  it('Feb 28 leap -> Feb 29 (returned as leap adjusted)', () => {
    // Feb 29 in leap year: getSday(2,29,2024) = '02-28'
    expect(nextday(2, 28, 2024)).toBe('02-28');
  });
});

describe('getWeek', () => {
  // Advent 2025: starts Nov 30
  it('Nov 30 2025 is Adv1', () => expect(getWeek(30, 11, 2025)).toBe('Adv1'));
  it('Dec 7 2025 is Adv2', () => expect(getWeek(7, 12, 2025)).toBe('Adv2'));

  // Christmas: Dec 25
  it('Dec 25 2025 is Nat25', () => expect(getWeek(25, 12, 2025)).toBe('Nat25'));
  it('Dec 26 2025 is Nat26', () => expect(getWeek(26, 12, 2025)).toBe('Nat26'));

  // Epiphany season (Jan 6 area, after octave of Christmas)
  it('Jan 6 2026 is in Nat or Epi season', () => {
    const w = getWeek(6, 1, 2026);
    expect(w).toMatch(/^(Nat|Epi)/);
  });

  // Easter 2026: Apr 5
  // Septuagesima = easter - 63 = Apr 5 - 63 days
  // Easter ydays 2026 = dateToYdays(5,4,2026) = 95
  // Quadp1 starts at 95-63=32 (Feb 1)
  it('Feb 1 2026 is Quadp1 (Septuagesima)', () => expect(getWeek(1, 2, 2026)).toBe('Quadp1'));
  it('Feb 8 2026 is Quadp2 (Sexagesima)', () => expect(getWeek(8, 2, 2026)).toBe('Quadp2'));
  it('Feb 15 2026 is Quadp3 (Quinquagesima)', () => expect(getWeek(15, 2, 2026)).toBe('Quadp3'));

  // Ash Wednesday 2026: Feb 18 (easter - 46 + 4... actually easter-46 = Mar 5 - 46...)
  // Lent starts Quad1: easter-42 = Feb 22 -> Quad1 starts Feb 22
  it('Feb 22 2026 is Quad1 (Ash Wednesday week)', () => expect(getWeek(22, 2, 2026)).toBe('Quad1'));
  it('Mar 1 2026 is Quad2', () => expect(getWeek(1, 3, 2026)).toBe('Quad2'));

  // Easter Sunday 2026
  it('Apr 5 2026 (Easter Sunday) is Pasc0', () => expect(getWeek(5, 4, 2026)).toBe('Pasc0'));
  it('Apr 12 2026 is Pasc1', () => expect(getWeek(12, 4, 2026)).toBe('Pasc1'));

  // Pentecost 2026: Easter + 49 = Apr 5 + 49 = May 24; getWeek returns Pent after Easter+56
  it('May 31 2026 is Pent01', () => expect(getWeek(31, 5, 2026)).toBe('Pent01'));

  // Pentecost season (various)
  it('Jun 7 2026 is Pent02', () => expect(getWeek(7, 6, 2026)).toBe('Pent02'));

  // Season codes correspond to correct seasons
  it('getWeek during Advent starts with Adv', () => {
    expect(getWeek(6, 12, 2026)).toMatch(/^Adv/);
  });
  it('getWeek during Lent starts with Quad', () => {
    expect(getWeek(15, 3, 2026)).toMatch(/^Quad/);
  });
  it('getWeek during Easter starts with Pasc', () => {
    expect(getWeek(5, 4, 2026)).toMatch(/^Pasc/);
  });
});

describe('seasonFromWeekRef', () => {
  it('Adv1 -> advent', () => expect(seasonFromWeekRef('Adv1')).toBe('advent'));
  it('Nat25 -> christmas', () => expect(seasonFromWeekRef('Nat25')).toBe('christmas'));
  it('Epi3 -> epiphany', () => expect(seasonFromWeekRef('Epi3')).toBe('epiphany'));
  it('Quadp1 -> septuagesima', () => expect(seasonFromWeekRef('Quadp1')).toBe('septuagesima'));
  it('Quad2 -> lent', () => expect(seasonFromWeekRef('Quad2')).toBe('lent'));
  it('Pasc0 -> easter', () => expect(seasonFromWeekRef('Pasc0')).toBe('easter'));
  it('Pent01 -> pentecost', () => expect(seasonFromWeekRef('Pent01')).toBe('pentecost'));
  it('PentEpi3 -> epiphany', () => expect(seasonFromWeekRef('PentEpi3')).toBe('epiphany'));
});
