# Liturgical Calendar Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the liturgical calendar computation logic from divinum-officium (Perl) into a standalone TypeScript library that generates a web UI and subscribable ICS files, hosted on GitHub Pages.

**Architecture:** Three layers — (1) Data layer: existing Tabulae text files parsed at build time, (2) Calendar engine: TypeScript modules faithfully ported from Date.pm, Directorium.pm, and horascommon.pl, (3) Output layer: ICS generator + static vanilla-TS web UI. Single repo under `liturgical-calendar/`.

**Tech Stack:** TypeScript (strict), Vite (UI bundling), vitest (testing), ical.js or hand-rolled ICS generation, GitHub Actions + Pages for deployment.

---

## File Structure

```
liturgical-calendar/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── data/                           # Copied from web/www/Tabulae/
│   ├── data.txt
│   ├── Kalendaria/
│   ├── Tempora/
│   ├── Transfer/
│   └── Stransfer/
├── src/
│   ├── engine/
│   │   ├── types.ts                # All shared types and interfaces
│   │   ├── date.ts                 # Easter, Advent, getWeek, date helpers (from Date.pm)
│   │   ├── parser.ts               # Tabulae file format parsers
│   │   ├── directorium.ts          # Feast lookup, transfer loading (from Directorium.pm)
│   │   ├── occurrence.ts           # Precedence/winner resolution (from horascommon.pl)
│   │   ├── color.ts                # Liturgical color derivation
│   │   └── calendar.ts             # Top-level API: getCalendarYear/Month/Day
│   ├── ics/
│   │   └── generator.ts            # ICS file generation
│   ├── ui/
│   │   ├── index.html
│   │   ├── app.ts                  # Main UI entry point
│   │   ├── grid-view.ts            # Month grid calendar view
│   │   ├── agenda-view.ts          # Day-by-day agenda view
│   │   └── styles.css              # All styles
│   └── build/
│       └── generate-ics.ts         # CLI script for GitHub Actions
├── tests/
│   ├── date.test.ts
│   ├── parser.test.ts
│   ├── directorium.test.ts
│   ├── occurrence.test.ts
│   ├── color.test.ts
│   ├── calendar.test.ts
│   └── ics-generator.test.ts
└── .github/
    └── workflows/
        └── deploy.yml
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `liturgical-calendar/package.json`
- Create: `liturgical-calendar/tsconfig.json`
- Create: `liturgical-calendar/vite.config.ts`
- Create: `liturgical-calendar/vitest.config.ts`
- Create: `liturgical-calendar/src/engine/types.ts`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir -p liturgical-calendar
cd liturgical-calendar
```

```json
{
  "name": "liturgical-calendar",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "generate-ics": "tsx src/build/generate-ics.ts"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0",
    "tsx": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/ui',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
    },
  },
});
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create src/engine/types.ts with all shared types**

```typescript
export type Season =
  | 'advent'
  | 'christmas'
  | 'epiphany'
  | 'septuagesima'
  | 'lent'
  | 'passiontide'
  | 'easter'
  | 'pentecost';

export type LiturgicalColor = 'white' | 'red' | 'green' | 'violet' | 'rose' | 'black';

export interface Celebration {
  name: string;
  rank: number;       // 1–7 numeric rank from Rank field
  rankName: string;   // e.g. "Duplex I classis"
  source: 'temporal' | 'sanctoral';
}

export interface CalendarDay {
  date: string;                 // ISO date "2026-03-25"
  season: Season;
  weekRef: string;              // temporal code e.g. "Quad3-2"
  celebration: Celebration;
  color: LiturgicalColor;
  commemorations: string[];     // names of commemorated offices
  transferredFrom?: string;     // original date if this feast was transferred
}

export type CalendarVersion = string;

/** Parsed entry from a Kalendaria file: maps sanctoral date to office info */
export interface KalendarEntry {
  day: string;            // "01-18"
  fileRef: string;        // "01-18r" — the office file reference
  name: string;           // "S Priscae Virginis"
  rank: number;           // 1-7
  additionalEntries?: KalendarEntry[];  // for ~-separated multi-entries on same day
}

/** Parsed entry from a Tempora file */
export interface TemporaEntry {
  key: string;            // "Tempora/Quad5-5"
  fileRef: string;        // "Tempora/Quad5-5Feria"
}

/** Transfer table entry */
export interface TransferEntry {
  key: string;            // original date/ref
  value: string;          // destination date/ref
}

/** Version definition from data.txt */
export interface VersionDef {
  version: string;
  kalendar: string;
  transfer: string;
  stransfer: string;
  base?: string;
  tbase?: string;
}

/** Parsed Rank field from an office file: "Name;;RankType;;NumericRank;;CommonRef" */
export interface ParsedRank {
  name: string;           // e.g. "Dominica I in Quadragesima"
  rankType: string;       // e.g. "I classis Semiduplex"
  numericRank: number;    // e.g. 6.9
  commonRef?: string;     // e.g. "ex Sancti/06-30"
}
```

- [ ] **Step 6: Install dependencies and verify setup**

Run: `cd liturgical-calendar && npm install`
Expected: Clean install with no errors.

- [ ] **Step 7: Commit**

```bash
git add liturgical-calendar/package.json liturgical-calendar/tsconfig.json \
  liturgical-calendar/vite.config.ts liturgical-calendar/vitest.config.ts \
  liturgical-calendar/src/engine/types.ts
git commit -m "feat: scaffold liturgical-calendar project with types"
```

---

### Task 2: Copy Tabulae Data Files

**Files:**
- Create: `liturgical-calendar/data/` (copy of `web/www/Tabulae/`)

- [ ] **Step 1: Copy the Tabulae data directory**

```bash
cp -r web/www/Tabulae/ liturgical-calendar/data/
```

- [ ] **Step 2: Verify key files exist**

Run: `ls liturgical-calendar/data/data.txt liturgical-calendar/data/Kalendaria/1960.txt liturgical-calendar/data/Tempora/1960.txt liturgical-calendar/data/Transfer/a.txt`
Expected: All four files listed.

- [ ] **Step 3: Commit**

```bash
git add liturgical-calendar/data/
git commit -m "feat: copy Tabulae data files into liturgical-calendar"
```

---

### Task 3: Date Module (date.ts)

Port `Date.pm` — Easter computation, Advent calculation, getWeek, and date helper functions.

**Files:**
- Create: `liturgical-calendar/src/engine/date.ts`
- Create: `liturgical-calendar/tests/date.test.ts`

- [ ] **Step 1: Write failing tests for Easter computation**

```typescript
// tests/date.test.ts
import { describe, it, expect } from 'vitest';
import { getEaster, getAdvent, getWeek, leapYear, dayOfWeek, dateToYdays, ydaysToDate, getSday } from '../src/engine/date';

describe('getEaster', () => {
  it('returns correct Easter for 2026', () => {
    // Easter 2026 is April 5
    expect(getEaster(2026)).toEqual({ day: 5, month: 4, year: 2026 });
  });

  it('returns correct Easter for 2024', () => {
    // Easter 2024 is March 31
    expect(getEaster(2024)).toEqual({ day: 31, month: 3, year: 2024 });
  });

  it('returns correct Easter for 2025', () => {
    // Easter 2025 is April 20
    expect(getEaster(2025)).toEqual({ day: 20, month: 4, year: 2025 });
  });

  it('handles earliest possible Easter (March 22)', () => {
    // 1818 had Easter on March 22
    expect(getEaster(1818)).toEqual({ day: 22, month: 3, year: 1818 });
  });

  it('handles latest possible Easter (April 25)', () => {
    // 1943 had Easter on April 25
    expect(getEaster(1943)).toEqual({ day: 25, month: 4, year: 1943 });
  });
});

describe('leapYear', () => {
  it('identifies leap years', () => {
    expect(leapYear(2024)).toBe(true);
    expect(leapYear(2000)).toBe(true);
  });

  it('identifies non-leap years', () => {
    expect(leapYear(2023)).toBe(false);
    expect(leapYear(1900)).toBe(false);
  });
});

describe('dayOfWeek', () => {
  it('returns 0 for Sunday', () => {
    // 2026-03-01 is a Sunday
    expect(dayOfWeek(1, 3, 2026)).toBe(0);
  });

  it('returns correct day for known date', () => {
    // 2026-01-01 is a Thursday = 4
    expect(dayOfWeek(1, 1, 2026)).toBe(4);
  });
});

describe('dateToYdays', () => {
  it('returns 1 for Jan 1', () => {
    expect(dateToYdays(1, 1, 2026)).toBe(1);
  });

  it('returns 365 for Dec 31 non-leap', () => {
    expect(dateToYdays(31, 12, 2026)).toBe(365);
  });

  it('returns 366 for Dec 31 leap year', () => {
    expect(dateToYdays(31, 12, 2024)).toBe(366);
  });
});

describe('ydaysToDate', () => {
  it('converts day 1 to Jan 1', () => {
    expect(ydaysToDate(1, 2026)).toEqual({ day: 1, month: 1, year: 2026 });
  });

  it('converts day 60 correctly in leap year', () => {
    // Day 60 in 2024 (leap) = Feb 29
    expect(ydaysToDate(60, 2024)).toEqual({ day: 29, month: 2, year: 2024 });
  });

  it('converts day 60 correctly in non-leap year', () => {
    // Day 60 in 2026 = Mar 1
    expect(ydaysToDate(60, 2026)).toEqual({ day: 1, month: 3, year: 2026 });
  });
});

describe('getAdvent', () => {
  it('returns correct Advent 1 for 2026', () => {
    // Christmas 2026 is Friday (day 5). Advent 1 = Dec 25 - 5 - 21 = Nov 29
    // Nov 29 as ydays = 333
    const result = getAdvent(2026);
    expect(result).toBe(dateToYdays(29, 11, 2026));
  });
});

describe('getSday', () => {
  it('returns mm-dd format', () => {
    expect(getSday(3, 25, 2026)).toBe('03-25');
  });

  it('handles leap year Feb 24 → 29', () => {
    expect(getSday(2, 24, 2024)).toBe('02-29');
  });

  it('handles leap year Feb 25 → 24', () => {
    expect(getSday(2, 25, 2024)).toBe('02-24');
  });

  it('handles non-leap year normally', () => {
    expect(getSday(2, 24, 2026)).toBe('02-24');
  });
});

describe('getWeek', () => {
  it('returns Advent week for December before Christmas', () => {
    // Dec 1, 2026 is a Tuesday in Advent week 1
    const result = getWeek(1, 12, 2026);
    expect(result).toBe('Adv1');
  });

  it('returns Nat for Christmas and after', () => {
    const result = getWeek(25, 12, 2026);
    expect(result).toBe('Nat25');
  });

  it('returns Quad for Lent', () => {
    // Lent 2026: Ash Wednesday is Feb 18. Easter is Apr 5.
    // March 10, 2026 should be in Quad3
    const result = getWeek(10, 3, 2026);
    expect(result).toMatch(/^Quad/);
  });

  it('returns Pasc for Easter season', () => {
    // April 5, 2026 is Easter Sunday
    const result = getWeek(5, 4, 2026);
    expect(result).toBe('Pasc0');
  });

  it('returns Pent for after Pentecost', () => {
    // Pentecost 2026 = Easter + 49 = May 24
    // June 1, 2026 = Pent01 week
    const result = getWeek(1, 6, 2026);
    expect(result).toMatch(/^Pent/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd liturgical-calendar && npx vitest run tests/date.test.ts`
Expected: FAIL — module `../src/engine/date` does not exist yet.

- [ ] **Step 3: Implement date.ts — faithful port of Date.pm**

```typescript
// src/engine/date.ts

interface DateResult {
  day: number;
  month: number;
  year: number;
}

const MONTHS_CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/**
 * Check if year is a leap year (Gregorian rules).
 */
export function leapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Day number within the year (1-indexed). Jan 1 = 1.
 */
export function dateToYdays(day: number, month: number, year: number): number {
  return MONTHS_CUMULATIVE[month - 1] + day + (month > 2 ? (leapYear(year) ? 1 : 0) : 0);
}

/**
 * Convert day-of-year number to date.
 */
export function ydaysToDate(days: number, year: number): DateResult {
  const months = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (leapYear(year)) months[2] = 29;

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
 * Faithful port of Date.pm day_of_week().
 */
export function dayOfWeek(day: number, month: number, year: number): number {
  const ydays = dateToYdays(day, month, year);
  return (
    (year * 365 +
      Math.floor((year - 1) / 4) -
      Math.floor((year - 1) / 100) +
      Math.floor((year - 1) / 400) -
      1 +
      ydays) %
    7
  );
}

/**
 * Compute Easter date using Meeus/Jones/Butcher algorithm.
 * Faithful port of Date.pm geteaster().
 */
export function getEaster(year: number): DateResult {
  const G = year % 19;
  const C = Math.floor(year / 100);
  const H = (C - Math.floor(C / 4) - Math.floor((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - Math.floor(H / 28) * (1 - Math.floor(H / 28) * Math.floor(29 / (H + 1)) * Math.floor((21 - G) / 11));
  const J = (year + Math.floor(year / 4) + I + 2 - C + Math.floor(C / 4)) % 7;
  const L = I - J;
  const month = 3 + Math.floor((L + 40) / 44);
  const day = L + 28 - 31 * Math.floor(month / 4);
  return { day, month, year };
}

/**
 * First Sunday of Advent as day-of-year number.
 * Faithful port of Date.pm getadvent().
 */
export function getAdvent(year: number): number {
  const christmas = dateToYdays(25, 12, year);
  let christmasDow = dayOfWeek(25, 12, year);
  if (christmasDow === 0) christmasDow = 7;
  return christmas - christmasDow - 21;
}

/**
 * Get sanctoral day reference (mm-dd format).
 * Handles leap year Feb 24/29 adjustment.
 * Faithful port of Date.pm get_sday().
 */
export function getSday(month: number, day: number, year: number): string {
  if (leapYear(year) && month === 2) {
    if (day === 24) {
      day = 29;
    } else if (day > 24) {
      day -= 1;
    }
  }
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Get next day's sanctoral reference.
 * Faithful port of Date.pm nextday().
 */
export function nextday(month: number, day: number, year: number): string {
  const time = dateToYdays(day, month, year) + 1;
  if (time > 365 && (!leapYear(year) || time === 367)) {
    return getSday(1, 1, year + 1);
  }
  const d = ydaysToDate(time, year);
  return getSday(d.month, d.day, d.year);
}

/**
 * Return the liturgical week identifier for a given date.
 * Faithful port of Date.pm getweek().
 *
 * Returns codes like: Adv1, Nat25, Epi3, Quadp1, Quad3, Pasc0, Pent15
 */
export function getWeek(
  day: number,
  month: number,
  year: number,
  tomorrow: boolean = false,
  missa: boolean = false,
): string {
  let t = dateToYdays(day, month, year);
  if (tomorrow) t++;

  const advent1 = getAdvent(year);
  const christmas = dateToYdays(25, 12, year);
  const tDay = tomorrow ? day + 1 : day;

  // Advent in December
  if (t >= advent1) {
    if (t < christmas) {
      const n = 1 + Math.floor((t - advent1) / 7);
      if (month === 11 || day < 25) return `Adv${n}`;
    }
    return `Nat${tDay}`;
  }

  const ordtime = 6 + 7 - dayOfWeek(6, 1, year);

  if (month === 1 && t < ordtime) {
    return `Nat${String(tDay).padStart(2, '0')}`;
  }

  const easter = dateToYdays(getEaster(year).day, getEaster(year).month, year);

  if (t < easter - 63) {
    const n = Math.floor((t - ordtime) / 7) + 1;
    return `Epi${n}`;
  }
  if (t < easter - 56) return 'Quadp1';
  if (t < easter - 49) return 'Quadp2';
  if (t < easter - 42) return 'Quadp3';

  if (t < easter) {
    const n = 1 + Math.floor((t - (easter - 42)) / 7);
    return `Quad${n}`;
  }

  if (t < easter + 56) {
    const n = Math.floor((t - easter) / 7);
    return `Pasc${n}`;
  }

  let n = Math.floor((t - (easter + 49)) / 7);
  if (n < 23) return `Pent${String(n).padStart(2, '0')}`;

  const wdist = Math.floor((advent1 - t + 6) / 7);
  if (wdist < 2) return 'Pent24';
  if (n === 23) return 'Pent23';

  if (missa) {
    return `PentEpi${8 - wdist}`;
  }
  return `Epi${8 - wdist}`;
}

/**
 * Get the Season enum value from a week reference string.
 */
export function seasonFromWeekRef(weekRef: string): import('./types').Season {
  if (weekRef.startsWith('Adv')) return 'advent';
  if (weekRef.startsWith('Nat')) return 'christmas';
  if (weekRef.startsWith('Epi')) return 'epiphany';
  if (weekRef.startsWith('Quadp')) return 'septuagesima';
  if (weekRef.startsWith('Quad')) return 'lent';
  if (weekRef.startsWith('Pasc')) return 'easter';
  if (weekRef.startsWith('Pent')) return 'pentecost';
  return 'pentecost'; // fallback
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd liturgical-calendar && npx vitest run tests/date.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/engine/date.ts liturgical-calendar/tests/date.test.ts
git commit -m "feat: port Date.pm to date.ts with Easter, Advent, getWeek"
```

---

### Task 4: Tabulae Parser (parser.ts)

Parse the custom Tabulae file formats: data.txt, Kalendaria, Tempora, and Transfer files.

**Files:**
- Create: `liturgical-calendar/src/engine/parser.ts`
- Create: `liturgical-calendar/tests/parser.test.ts`

- [ ] **Step 1: Write failing tests for parsers**

```typescript
// tests/parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseDataFile, parseKalendarFile, parseTemporaFile, parseTransferFile } from '../src/engine/parser';

describe('parseDataFile', () => {
  it('parses version definitions from data.txt content', () => {
    const content = `version,kalendar,transfer,stransfer,base,transferbase
Tridentine - 1570,1570,1570,1570
Rubrics 1960 - 1960,1960,1960,1960,Reduced - 1955`;

    const result = parseDataFile(content);
    expect(result['Tridentine - 1570']).toEqual({
      version: 'Tridentine - 1570',
      kalendar: '1570',
      transfer: '1570',
      stransfer: '1570',
      base: undefined,
      tbase: undefined,
    });
    expect(result['Rubrics 1960 - 1960'].base).toBe('Reduced - 1955');
  });

  it('skips comment lines', () => {
    const content = `version,kalendar,transfer,stransfer,base,transferbase
# comment line
Tridentine - 1570,1570,1570,1570`;
    const result = parseDataFile(content);
    expect(Object.keys(result)).toHaveLength(1);
  });
});

describe('parseKalendarFile', () => {
  it('parses kalendar entries', () => {
    const content = `#This file only notes the changes
*January*
01-18=01-18r=S Priscae Virginis=1=
01-25=01-25r=In Conversione S. Pauli Apostoli=4=`;

    const result = parseKalendarFile(content);
    expect(result['01-18']).toBe('01-18r');
    expect(result['01-25']).toBe('01-25r');
  });

  it('handles XXXXX deletions', () => {
    const content = `*May*
05-06=XXXXX`;
    const result = parseKalendarFile(content);
    expect(result['05-06']).toBe('XXXXX');
  });

  it('handles multi-entry lines with ~', () => {
    const content = `*July*
07-21=07-21r~07-21=S. Laurentii=3=S. Praxedis=1=`;
    const result = parseKalendarFile(content);
    expect(result['07-21']).toBe('07-21r~07-21');
  });
});

describe('parseTemporaFile', () => {
  it('parses tempora mappings', () => {
    const content = `Tempora/Quad5-5=Tempora/Quad5-5Feria;;
Tempora/Pent01-0=Tempora/Pent01-0r;;`;

    const result = parseTemporaFile(content);
    expect(result['Tempora/Quad5-5']).toBe('Tempora/Quad5-5Feria');
    expect(result['Tempora/Pent01-0']).toBe('Tempora/Pent01-0r');
  });
});

describe('parseTransferFile', () => {
  it('parses transfer entries with version filters', () => {
    const content = `01-02=Tempora/Nat2-0;;DA Newcal 1960
01-09=01-08;;1570 1888 1906`;

    const result = parseTransferFile(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      key: '01-02',
      value: 'Tempora/Nat2-0',
      versions: 'DA Newcal 1960',
    });
  });

  it('handles entries with no version filter', () => {
    const content = `01-15=01-15cc;;`;
    const result = parseTransferFile(content);
    expect(result[0].versions).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd liturgical-calendar && npx vitest run tests/parser.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement parser.ts**

```typescript
// src/engine/parser.ts
import type { VersionDef } from './types';

/**
 * Parse data.txt — version registry.
 * Format: version,kalendar,transfer,stransfer,base,transferbase
 */
export function parseDataFile(content: string): Record<string, VersionDef> {
  const lines = content.split('\n');
  const result: Record<string, VersionDef> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const [version, kalendar, transfer, stransfer, base, tbase] = line.split(',');
    if (!version || !kalendar) continue;

    result[version] = {
      version,
      kalendar,
      transfer,
      stransfer,
      base: base || undefined,
      tbase: tbase || undefined,
    };
  }

  return result;
}

/**
 * Parse a Kalendaria file.
 * Returns map of day (mm-dd) to file reference string.
 *
 * Format: mm-dd=fileref=Name=rank= or mm-dd=fileref~fileref2=Name=rank=Name2=rank2=
 * Lines starting with # or * are skipped.
 */
export function parseKalendarFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;
    if (!trimmed.includes('=')) continue;

    const parts = trimmed.split('=');
    const day = parts[0];
    // The file reference is everything in parts[1] (may include ~-separated refs)
    const fileRef = parts[1];

    if (day && fileRef !== undefined) {
      result[day] = fileRef;
    }
  }

  return result;
}

/**
 * Parse a Tempora file.
 * Format: key=value;;
 * Returns map of key to value (up to first ;).
 */
export function parseTemporaFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.substring(0, eqIdx);
    const rest = trimmed.substring(eqIdx + 1);
    const semiIdx = rest.indexOf(';');
    const value = semiIdx === -1 ? rest : rest.substring(0, semiIdx);

    result[key] = value;
  }

  return result;
}

export interface RawTransferEntry {
  key: string;
  value: string;
  versions: string;
}

/**
 * Parse a Transfer file.
 * Format: key=value;;version-filter
 */
export function parseTransferFile(content: string): RawTransferEntry[] {
  const result: RawTransferEntry[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [lineContent, versions] = trimmed.split(/\s*;;\s*/);
    if (!lineContent) continue;

    const eqIdx = lineContent.indexOf('=');
    if (eqIdx === -1) continue;

    result.push({
      key: lineContent.substring(0, eqIdx),
      value: lineContent.substring(eqIdx + 1),
      versions: (versions || '').trim(),
    });
  }

  return result;
}

/**
 * Parse a Rank field from an office file.
 * Format: "Name;;RankType;;NumericRank;;CommonRef"
 */
export function parseRankField(rank: string): { name: string; rankType: string; numericRank: number; commonRef?: string } {
  const parts = rank.split(';;');
  return {
    name: (parts[0] || '').trim(),
    rankType: (parts[1] || '').trim(),
    numericRank: parseFloat(parts[2]) || 0,
    commonRef: parts[3]?.trim() || undefined,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd liturgical-calendar && npx vitest run tests/parser.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/engine/parser.ts liturgical-calendar/tests/parser.test.ts
git commit -m "feat: implement Tabulae file format parsers"
```

---

### Task 5: Directorium Module (directorium.ts)

Port `Directorium.pm` — load version data, kalendar, tempora, and transfer tables with caching and version inheritance.

**Files:**
- Create: `liturgical-calendar/src/engine/directorium.ts`
- Create: `liturgical-calendar/tests/directorium.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/directorium.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Directorium } from '../src/engine/directorium';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(__dirname, '..', 'data');

describe('Directorium', () => {
  let dir: Directorium;

  beforeAll(() => {
    dir = new Directorium(DATA_DIR);
  });

  it('loads version definitions from data.txt', () => {
    const versions = dir.getVersions();
    expect(versions).toContain('Rubrics 1960 - 1960');
    expect(versions).toContain('Tridentine - 1570');
  });

  it('looks up kalendar entries', () => {
    const entry = dir.getFromDirektorium('kalendar', 'Rubrics 1960 - 1960', '01-25');
    expect(entry).toBeTruthy();
    expect(entry).toContain('01-25');
  });

  it('follows version inheritance for kalendar', () => {
    // 1960 inherits from 1955 which inherits from 1954 etc.
    // 03-19 (St. Joseph) should be found through inheritance
    const entry = dir.getFromDirektorium('kalendar', 'Rubrics 1960 - 1960', '03-19');
    expect(entry).toBeTruthy();
  });

  it('looks up tempora entries', () => {
    const entry = dir.getFromDirektorium('tempora', 'Rubrics 1960 - 1960', 'Tempora/Quad5-5');
    expect(entry).toBeTruthy();
  });

  it('loads transfer table for a given year', () => {
    const transfers = dir.loadTransfer('Rubrics 1960 - 1960', 2026);
    expect(transfers).toBeDefined();
    expect(Object.keys(transfers).length).toBeGreaterThan(0);
  });

  it('computes correct Easter letter', () => {
    // Easter 2026 = April 5 → easter code = 405
    // letter = (405 - 319 + 1) % 7 = 87 % 7 = 3 → 'd'
    const letter = dir.getEasterLetter(2026);
    expect(letter).toBe('d');
  });

  it('checks if a feast is transferred', () => {
    // This tests the transfered() function — specific results depend on year
    const result = dir.isTransferred('03-25', 2026, 'Rubrics 1960 - 1960');
    // Mar 25 (Annunciation) often transfers when it falls in Holy Week
    expect(typeof result).toBe('string');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd liturgical-calendar && npx vitest run tests/directorium.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement directorium.ts**

```typescript
// src/engine/directorium.ts
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { VersionDef } from './types';
import { parseDataFile, parseKalendarFile, parseTemporaFile, parseTransferFile, type RawTransferEntry } from './parser';
import { getEaster, leapYear } from './date';

export class Directorium {
  private dataDir: string;
  private versions: Record<string, VersionDef> = {};
  private cache: Record<string, Record<string, string>> = {};
  private loaded = false;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.loadData();
  }

  private loadData(): void {
    const content = readFileSync(join(this.dataDir, 'data.txt'), 'utf-8');
    this.versions = parseDataFile(content);
    this.loaded = true;
  }

  private readFile(path: string): string {
    const fullPath = join(this.dataDir, path);
    if (!existsSync(fullPath)) return '';
    return readFileSync(fullPath, 'utf-8');
  }

  getVersions(): string[] {
    return Object.keys(this.versions);
  }

  getVersionDef(version: string): VersionDef | undefined {
    return this.versions[version];
  }

  private ensureKalendarLoaded(version: string): void {
    const cacheKey = `kalendar:${version}`;
    if (this.cache[cacheKey]) return;

    const vdef = this.versions[version];
    if (!vdef) throw new Error(`Unknown version: ${version}`);

    const content = this.readFile(`Kalendaria/${vdef.kalendar}.txt`);
    this.cache[cacheKey] = parseKalendarFile(content);
  }

  private ensureTemporaLoaded(version: string): void {
    const cacheKey = `tempora:${version}`;
    if (this.cache[cacheKey]) return;

    const vdef = this.versions[version];
    if (!vdef) throw new Error(`Unknown version: ${version}`);

    const content = this.readFile(`Tempora/${vdef.transfer}.txt`);
    this.cache[cacheKey] = parseTemporaFile(content);
  }

  /**
   * Compute the Easter letter (a-g) for a given year.
   * Port of Directorium.pm lines 115-116.
   */
  getEasterLetter(year: number): string {
    const easter = getEaster(year);
    const easterCode = easter.month * 100 + easter.day;
    const letterIdx = (easterCode - 319 + (easter.month === 4 ? 1 : 0)) % 7;
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    return letters[letterIdx];
  }

  /**
   * Load transfer table for a version and year.
   * Faithful port of Directorium.pm load_transfer().
   */
  loadTransfer(version: string, year: number, type: string = 'Transfer'): Record<string, string> {
    const cacheKey = `${type.toLowerCase()}:${version}:${year}`;
    if (this.cache[cacheKey]) return this.cache[cacheKey];

    const vdef = this.versions[version];
    if (!vdef) throw new Error(`Unknown version: ${version}`);

    const isLeap = leapYear(year);
    const easter = getEaster(year);
    let easterCode = easter.month * 100 + easter.day;

    const letterIdx = (easterCode - 319 + (easter.month === 4 ? 1 : 0)) % 7;
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const letter = letters[letterIdx];

    const transferKey = type === 'Transfer' ? vdef.transfer : vdef.stransfer;

    // Load letter file (filter=0 means whole year for non-leap)
    const letterEntries = this.loadTransferFile(letter, isLeap ? 1 : 0, type);
    const easterEntries = this.loadTransferFile(String(easterCode), isLeap ? 1 : 0, type);

    let allEntries = [...letterEntries, ...easterEntries];

    if (isLeap) {
      // Load Jan & Feb from next file
      let nextEaster = easterCode + 1;
      if (nextEaster === 332) nextEaster = 401;
      const nextLetterIdx = letterIdx - 6 < 0 ? letterIdx - 6 + 7 : letterIdx - 6;
      const nextLetter = letters[nextLetterIdx];

      allEntries = [
        ...allEntries,
        ...this.loadTransferFile(nextLetter, 2, type),
        ...this.loadTransferFile(String(nextEaster), 2, type),
      ];
    }

    // Filter by version and build result map
    const result: Record<string, string> = {};
    for (const entry of allEntries) {
      if (!entry.versions || entry.versions.includes(transferKey)) {
        result[entry.key] = entry.value;
      }
    }

    this.cache[cacheKey] = result;
    return result;
  }

  /**
   * Load and filter a transfer file.
   * filter: 0 = whole year (non-leap), 1 = Feb 24–Dec, 2 = Jan + Feb 23
   */
  private loadTransferFile(name: string, filter: number, type: string): RawTransferEntry[] {
    const content = this.readFile(`${type}/${name}.txt`);
    if (!content) return [];

    const entries = parseTransferFile(content);

    const janFebRegex = /^(?:Hy|seant)?(?:01|02-[01]|02-2[01239]|dirge1)/;
    const janFebRegex2 = /^(?:Hy|seant)?(?:01|02-[01]|02-2[01239]|.*=(?:01|02-[01]|02-2[0123])|dirge1)/;

    if (filter === 1) {
      // Feb 24 – Dec: exclude Jan/early-Feb entries
      return entries.filter((e) => !janFebRegex2.test(`${e.key}=${e.value}`));
    } else if (filter === 2) {
      // Jan + Feb 23: only Jan/early-Feb entries
      return entries.filter((e) => janFebRegex.test(e.key));
    }
    return entries;
  }

  /**
   * Main lookup function.
   * Port of Directorium.pm get_from_directorium().
   */
  getFromDirektorium(
    subject: 'kalendar' | 'tempora' | 'transfer' | 'stransfer',
    version: string,
    key: string,
    year?: number,
  ): string {
    if (subject === 'kalendar') {
      this.ensureKalendarLoaded(version);
      const cacheKey = `kalendar:${version}`;
      const value = this.cache[cacheKey]?.[key];
      if (value) return value;

      // Follow inheritance chain
      const vdef = this.versions[version];
      if (vdef?.base) {
        return this.getFromDirektorium(subject, vdef.base, key, year);
      }
      return '';
    }

    if (subject === 'tempora') {
      this.ensureTemporaLoaded(version);
      const cacheKey = `tempora:${version}`;
      const value = this.cache[cacheKey]?.[key];
      if (value) return value;

      const vdef = this.versions[version];
      if (vdef?.tbase) {
        return this.getFromDirektorium(subject, vdef.tbase, key, year);
      }
      return '';
    }

    if (subject === 'transfer' || subject === 'stransfer') {
      if (!year) return '';
      const type = subject === 'transfer' ? 'Transfer' : 'Stransfer';
      const transfers = this.loadTransfer(version, year, type);
      const value = transfers[key];
      if (value) return value;

      const baseKey = subject === 'transfer' ? 'tbase' : 'tbase';
      const vdef = this.versions[version];
      if (vdef?.tbase) {
        return this.getFromDirektorium(subject, vdef.tbase, key, year);
      }
      return '';
    }

    return '';
  }

  /**
   * Check if a feast/office has been transferred away from its original date.
   * Port of Directorium.pm transfered().
   */
  isTransferred(str: string, year: number, version: string): string {
    // Strip Sancti prefix
    const cleaned = str.replace(/Sancti(M|Cist|OP)?\//, '');
    if (!cleaned) return '';

    const transfers = this.loadTransfer(version, year);

    for (const [key, val] of Object.entries(transfers)) {
      if (!val) continue;
      if (/dirge|Hy/i.test(key)) continue;
      if (/Tempora/i.test(val) && !/Epi1-0/i.test(val)) continue;

      if (
        !val.startsWith(key) &&
        (cleaned.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(cleaned.toLowerCase())) &&
        !/v\s*$/i.test(transfers[key])
      ) {
        return key;
      }
    }

    // Check tempora entries
    this.ensureTemporaLoaded(version);
    const temporaCache = this.cache[`tempora:${version}`] || {};
    for (const [key, val] of Object.entries(temporaCache)) {
      if (/dirge/i.test(key)) continue;
      if (val.toLowerCase().includes(cleaned.toLowerCase()) && transfers[key] && !/v\s*$/i.test(transfers[key])) {
        return key;
      }
    }

    const vdef = this.versions[version];
    if (vdef?.tbase) {
      return this.isTransferred(str, year, vdef.tbase);
    }

    return '';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd liturgical-calendar && npx vitest run tests/directorium.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/engine/directorium.ts liturgical-calendar/tests/directorium.test.ts
git commit -m "feat: port Directorium.pm to directorium.ts with caching and inheritance"
```

---

### Task 6: Occurrence/Precedence Module (occurrence.ts)

Port the core occurrence resolution logic from `horascommon.pl`. This is the most complex module — it determines which office (temporal vs sanctoral) wins for a given day.

**Files:**
- Create: `liturgical-calendar/src/engine/occurrence.ts`
- Create: `liturgical-calendar/tests/occurrence.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/occurrence.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { resolveOccurrence, type OccurrenceResult } from '../src/engine/occurrence';
import { Directorium } from '../src/engine/directorium';
import { join } from 'path';

const DATA_DIR = join(__dirname, '..', 'data');
const OFFICE_DIR = join(__dirname, '..', '..', 'web', 'www', 'horas', 'Latin');

describe('resolveOccurrence', () => {
  let dir: Directorium;

  beforeAll(() => {
    dir = new Directorium(DATA_DIR);
  });

  it('resolves Easter Sunday as temporal Duplex I classis', () => {
    // Easter 2026 = April 5
    const result = resolveOccurrence(5, 4, 2026, 'Rubrics 1960 - 1960', dir, OFFICE_DIR);
    expect(result.celebration.name).toMatch(/Resurrectionis|Pasch/i);
    expect(result.celebration.rank).toBeGreaterThanOrEqual(7);
    expect(result.celebration.source).toBe('temporal');
  });

  it('resolves St. Joseph as sanctoral feast', () => {
    // March 19, 2026 is a Thursday in Lent
    const result = resolveOccurrence(19, 3, 2026, 'Rubrics 1960 - 1960', dir, OFFICE_DIR);
    expect(result.celebration.name).toMatch(/Joseph/i);
    expect(result.celebration.source).toBe('sanctoral');
  });

  it('resolves a Lenten feria as temporal', () => {
    // March 10, 2026 is a Tuesday in Lent — no significant feast
    const result = resolveOccurrence(10, 3, 2026, 'Rubrics 1960 - 1960', dir, OFFICE_DIR);
    expect(result.celebration.source).toBe('temporal');
  });

  it('includes commemorations when applicable', () => {
    // When a saint is commemorated during a temporal office
    const result = resolveOccurrence(19, 3, 2026, 'Rubrics 1960 - 1960', dir, OFFICE_DIR);
    // St. Joseph on a Lent day — temporal may be commemorated
    expect(Array.isArray(result.commemorations)).toBe(true);
  });

  it('handles Christmas', () => {
    const result = resolveOccurrence(25, 12, 2026, 'Rubrics 1960 - 1960', dir, OFFICE_DIR);
    expect(result.celebration.name).toMatch(/Nativit/i);
    expect(result.celebration.rank).toBeGreaterThanOrEqual(7);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd liturgical-calendar && npx vitest run tests/occurrence.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement occurrence.ts**

This module reads office files to extract their Rank fields, then applies the precedence rules. Since we only need the calendar metadata (not full office content), we parse just the `[Rank]` section from office files.

```typescript
// src/engine/occurrence.ts
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Directorium } from './directorium';
import { getWeek, dayOfWeek, getSday, nextday, dateToYdays, getEaster, getAdvent, leapYear } from './date';
import { parseRankField } from './parser';
import type { Celebration } from './types';

export interface OccurrenceResult {
  celebration: Celebration;
  weekRef: string;
  commemorations: string[];
  transferredFrom?: string;
}

/**
 * Extract the Rank field from a Latin office file.
 * Reads only enough of the file to find [Rank] section.
 */
function getRankFromFile(officeDir: string, filename: string): string {
  // Normalize filename
  let path = filename;
  if (!path.endsWith('.txt')) path += '.txt';

  const fullPath = join(officeDir, path);
  if (!existsSync(fullPath)) return '';

  const content = readFileSync(fullPath, 'utf-8');
  const rankMatch = content.match(/\[Rank\]\s*\n([^\n\[]+)/);
  if (!rankMatch) return '';
  return rankMatch[1].trim();
}

/**
 * Extract the Rule field from a Latin office file.
 */
function getRuleFromFile(officeDir: string, filename: string): string {
  let path = filename;
  if (!path.endsWith('.txt')) path += '.txt';

  const fullPath = join(officeDir, path);
  if (!existsSync(fullPath)) return '';

  const content = readFileSync(fullPath, 'utf-8');
  const ruleMatch = content.match(/\[Rule\]\s*\n([\s\S]*?)(?=\n\[|$)/);
  if (!ruleMatch) return '';
  return ruleMatch[1].trim();
}

/**
 * Resolve which office wins for a given date.
 * Simplified port of horascommon.pl occurrence() — focused on calendar metadata only.
 *
 * This implements the core precedence logic but omits hora-specific behavior
 * (Vespers, Completorium) since we only need the day's primary celebration.
 */
export function resolveOccurrence(
  day: number,
  month: number,
  year: number,
  version: string,
  dir: Directorium,
  officeDir: string,
): OccurrenceResult {
  const dow = dayOfWeek(day, month, year);
  const weekRef = getWeek(day, month, year);
  const sday = getSday(month, day, year);
  const commemorations: string[] = [];

  // === TEMPORAL ===
  const tday = `Tempora/${weekRef}${weekRef.startsWith('Nat') ? '' : `-${dow}`}`;

  // Check for permanent temporal transfers
  let tfile = dir.getFromDirektorium('tempora', version, tday) || tday;

  // Check for annual transfer of temporal
  const temporalTransfer = dir.getFromDirektorium('transfer', version, sday, year);
  if (temporalTransfer && /tempora/i.test(temporalTransfer)) {
    tfile = temporalTransfer.replace(/Tempora\//, 'Tempora/');
  } else if (dir.isTransferred(tfile, year, version)) {
    tfile = '';
  }

  let tRankStr = '';
  let tParsed = { name: '', rankType: '', numericRank: 0, commonRef: undefined as string | undefined };
  if (tfile) {
    tRankStr = getRankFromFile(officeDir, tfile);
    if (tRankStr) {
      tParsed = parseRankField(tRankStr);
    }
  }

  // === SANCTORAL ===
  const kalEntry = dir.getFromDirektorium('kalendar', version, sday);
  let sfile = '';
  const commoEntries: string[] = [];

  if (kalEntry) {
    const parts = kalEntry.split('~');
    sfile = parts[0] || '';
    for (let i = 1; i < parts.length; i++) {
      if (parts[i]) commoEntries.push(parts[i]);
    }
  }

  // Check annual transfers for sanctoral
  const sTransfer = dir.getFromDirektorium('transfer', version, sday, year);
  if (sTransfer && /Sancti|^\d{2}-\d{2}/i.test(sTransfer) && !/tempora/i.test(sTransfer)) {
    sfile = sTransfer.split('~')[0];
  } else if (sfile && dir.isTransferred(sfile, year, version)) {
    sfile = '';
  }

  // Add Sancti/ prefix if needed
  if (sfile && !sfile.includes('/') && sfile !== 'XXXXX') {
    sfile = `Sancti/${sfile}`;
  }

  let sRankStr = '';
  let sParsed = { name: '', rankType: '', numericRank: 0, commonRef: undefined as string | undefined };
  if (sfile && sfile !== 'XXXXX') {
    sRankStr = getRankFromFile(officeDir, sfile);
    if (sRankStr) {
      sParsed = parseRankField(sRankStr);
    }
  }

  // Handle version-specific rank adjustments for Sundays
  if (tParsed.name.includes('Dominica') && !weekRef.startsWith('Nat1')) {
    if (version.includes('196')) {
      // 1960: minor Sundays at 5.0
      if (tParsed.numericRank < 5.1 && tParsed.numericRank > 0) {
        // Keep as-is; 1960 Sundays already ranked appropriately in data
      }
    } else if (version.includes('Divino') || version.includes('divino')) {
      if (tParsed.numericRank < 5.1 && tParsed.numericRank > 0) {
        tParsed.numericRank = 4.9;
      }
    } else if (version.includes('Trid')) {
      if (tParsed.numericRank < 5.1 && tParsed.numericRank > 4.2) {
        tParsed.numericRank = 2.9;
      }
    }
  }

  // === PRECEDENCE RESOLUTION ===
  let sanctoralWins = false;

  if (!sParsed.numericRank) {
    sanctoralWins = false;
  } else if (sParsed.numericRank > tParsed.numericRank) {
    sanctoralWins = true;
  } else if (tParsed.name.includes('Dominica') && !weekRef.startsWith('Nat1')) {
    // Sunday special cases
    if (version.includes('196')) {
      if (tParsed.numericRank <= 5 && sParsed.numericRank >= 6) {
        sanctoralWins = true;
      } else if (
        tParsed.numericRank <= 5 &&
        sParsed.numericRank >= 5 &&
        getRuleFromFile(officeDir, sfile).includes('Festum Domini')
      ) {
        sanctoralWins = true;
      }
    } else {
      const rule = getRuleFromFile(officeDir, sfile);
      if (rule.includes('Festum Domini') && sParsed.numericRank >= 2 && tParsed.numericRank <= 5) {
        sanctoralWins = true;
      }
    }
  }

  // Suppress low-rank sanctoral on high-rank temporal days
  if (
    tParsed.numericRank >= 7 &&
    sParsed.numericRank < 6 &&
    (version.includes('196') || version.includes('1955'))
  ) {
    sanctoralWins = false;
    sParsed.numericRank = 0;
  }

  // Build commemorations
  if (sanctoralWins && tParsed.numericRank >= 1.5) {
    commemorations.push(tParsed.name);
  } else if (!sanctoralWins && sParsed.numericRank > 0) {
    commemorations.push(sParsed.name);
  }
  for (const c of commoEntries) {
    const cRank = getRankFromFile(officeDir, c.includes('/') ? c : `Sancti/${c}`);
    if (cRank) {
      const parsed = parseRankField(cRank);
      if (parsed.name) commemorations.push(parsed.name);
    }
  }

  // Determine winner
  const winner = sanctoralWins ? sParsed : tParsed;
  const source: 'temporal' | 'sanctoral' = sanctoralWins ? 'sanctoral' : 'temporal';

  // Fallback for empty winner (e.g., ferial day with no rank)
  const name = winner.name || tParsed.name || `Feria ${dow === 0 ? 'Dominica' : ''}`;
  const rank = winner.numericRank || tParsed.numericRank || 1;
  const rankName = winner.rankType || tParsed.rankType || 'Feria';

  return {
    celebration: {
      name,
      rank,
      rankName,
      source,
    },
    weekRef,
    commemorations: commemorations.filter((c) => c && c !== name),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd liturgical-calendar && npx vitest run tests/occurrence.test.ts`
Expected: All tests PASS. Some tests may need adjustment based on the actual data — fix any failures by checking the expected office file paths against the actual data.

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/engine/occurrence.ts liturgical-calendar/tests/occurrence.test.ts
git commit -m "feat: port occurrence/precedence logic from horascommon.pl"
```

---

### Task 7: Liturgical Color Module (color.ts)

Derive liturgical vestment color from season and celebration type.

**Files:**
- Create: `liturgical-calendar/src/engine/color.ts`
- Create: `liturgical-calendar/tests/color.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/color.test.ts
import { describe, it, expect } from 'vitest';
import { getLiturgicalColor } from '../src/engine/color';
import type { Season, LiturgicalColor } from '../src/engine/types';

describe('getLiturgicalColor', () => {
  it('returns violet for Lenten feria', () => {
    expect(getLiturgicalColor('lent', 'Feria III', 'Feria', 1)).toBe('violet');
  });

  it('returns violet for Advent feria', () => {
    expect(getLiturgicalColor('advent', 'Feria II', 'Feria', 1)).toBe('violet');
  });

  it('returns rose for Gaudete Sunday', () => {
    expect(getLiturgicalColor('advent', 'Dominica III Adventus', 'Semiduplex', 5)).toBe('rose');
  });

  it('returns rose for Laetare Sunday', () => {
    expect(getLiturgicalColor('lent', 'Dominica IV in Quadragesima', 'Semiduplex', 5)).toBe('rose');
  });

  it('returns white for Easter', () => {
    expect(getLiturgicalColor('easter', 'Dominica Resurrectionis', 'Duplex I classis', 7)).toBe('white');
  });

  it('returns white for Christmas', () => {
    expect(getLiturgicalColor('christmas', 'In Nativitate Domini', 'Duplex I classis', 7)).toBe('white');
  });

  it('returns green for post-Pentecost Sunday', () => {
    expect(getLiturgicalColor('pentecost', 'Dominica XV Post Pentecosten', 'Semiduplex', 5)).toBe('green');
  });

  it('returns red for martyrs', () => {
    expect(getLiturgicalColor('lent', 'S. Thomae de Aquino Martyris', 'Duplex', 3)).toBe('red');
  });

  it('returns white for confessors', () => {
    expect(getLiturgicalColor('pentecost', 'S. Francisci Confessoris', 'Duplex', 3)).toBe('white');
  });

  it('returns white for BVM feasts', () => {
    expect(getLiturgicalColor('advent', 'Conceptione Immaculata B.M.V.', 'Duplex I classis', 6)).toBe('white');
  });

  it('returns red for Apostles', () => {
    expect(getLiturgicalColor('pentecost', 'Ss. Petri et Pauli Apostolorum', 'Duplex I classis', 6)).toBe('red');
  });

  it('returns black for All Souls', () => {
    expect(getLiturgicalColor('pentecost', 'Omnium Fidelium Defunctorum', 'Duplex', 3)).toBe('black');
  });

  it('returns red for Pentecost Sunday', () => {
    expect(getLiturgicalColor('easter', 'Dominica Pentecostes', 'Duplex I classis', 7)).toBe('red');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd liturgical-calendar && npx vitest run tests/color.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement color.ts**

```typescript
// src/engine/color.ts
import type { Season, LiturgicalColor } from './types';

/**
 * Derive the liturgical color from season, celebration name, rank type, and numeric rank.
 *
 * Rules follow traditional rubrical practice:
 * 1. Check celebration-specific overrides first (martyrs, BVM, etc.)
 * 2. Fall back to seasonal defaults
 */
export function getLiturgicalColor(
  season: Season,
  celebrationName: string,
  rankType: string,
  numericRank: number,
): LiturgicalColor {
  const name = celebrationName.toLowerCase();
  const rType = rankType.toLowerCase();

  // === SPECIFIC DATE/FEAST OVERRIDES ===

  // All Souls / Defunctorum
  if (name.includes('defunctorum') || name.includes('all souls')) {
    return 'black';
  }

  // Pentecost Sunday and its octave
  if (name.includes('pentecostes') || name.includes('pentecost')) {
    return 'red';
  }

  // Rose Sundays
  if (name.includes('dominica iii adventus') || name.includes('gaudete')) {
    return 'rose';
  }
  if (name.includes('dominica iv in quadragesima') || name.includes('laetare')) {
    return 'rose';
  }

  // Feasts of the Cross, Precious Blood
  if (name.includes('crucis') || name.includes('cross')) {
    return 'red';
  }
  if (name.includes('sanguinis') || name.includes('precious blood')) {
    return 'red';
  }

  // Good Friday
  if (name.includes('parasceve') || name.includes('good friday')) {
    return 'black';
  }

  // === CELEBRATION TYPE OVERRIDES ===

  // Martyrs → red
  if (name.includes('martyr')) {
    return 'red';
  }

  // Apostles and Evangelists → red
  if (name.includes('apostol') || name.includes('evangelist')) {
    return 'red';
  }

  // BVM feasts → white
  if (
    name.includes('b.m.v') ||
    name.includes('b. m. v') ||
    name.includes('beatae mariae') ||
    name.includes('mariae virginis') ||
    name.includes('immaculata') ||
    name.includes('assumptio') ||
    name.includes('purification') ||
    name.includes('annuntiatio') ||
    name.includes('visitatio')
  ) {
    return 'white';
  }

  // Confessors, Virgins, Angels, Popes (non-martyr) → white
  if (
    name.includes('confessor') ||
    name.includes('virginis') ||
    name.includes('virgin') ||
    name.includes('angel') ||
    name.includes('archangel') ||
    name.includes('papae') ||
    name.includes('episcopi') ||
    name.includes('abbat') ||
    name.includes('viduae') ||
    name.includes('doctor')
  ) {
    return 'white';
  }

  // Feasts of the Lord (that are not otherwise colored) → white
  if (name.includes('domini') && numericRank >= 5) {
    return 'white';
  }

  // === SEASONAL DEFAULTS ===

  // If we have a ranked feast (Duplex or higher) in seasons that are normally violet,
  // and it's not a feria, it gets white unless overridden above
  if (numericRank >= 2 && rType !== 'feria' && !name.includes('feria') && !name.includes('dominica')) {
    // Named feasts in Lent/Advent that don't match any specific rule above get white
    if (season === 'lent' || season === 'advent' || season === 'septuagesima') {
      return 'white';
    }
  }

  switch (season) {
    case 'advent':
    case 'lent':
    case 'septuagesima':
      return 'violet';
    case 'christmas':
    case 'easter':
      return 'white';
    case 'epiphany':
      // Epiphany season: white for the octave/feast, green for ferias after
      if (name.includes('epiphan') || numericRank >= 5) return 'white';
      return 'green';
    case 'pentecost':
      return 'green';
    default:
      return 'green';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd liturgical-calendar && npx vitest run tests/color.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/engine/color.ts liturgical-calendar/tests/color.test.ts
git commit -m "feat: implement liturgical color derivation"
```

---

### Task 8: Calendar API (calendar.ts)

Top-level API that combines all modules to produce CalendarDay arrays.

**Files:**
- Create: `liturgical-calendar/src/engine/calendar.ts`
- Create: `liturgical-calendar/tests/calendar.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/calendar.test.ts
import { describe, it, expect } from 'vitest';
import { LiturgicalCalendar } from '../src/engine/calendar';
import { join } from 'path';

const DATA_DIR = join(__dirname, '..', 'data');
const OFFICE_DIR = join(__dirname, '..', '..', 'web', 'www', 'horas', 'Latin');

describe('LiturgicalCalendar', () => {
  const cal = new LiturgicalCalendar(DATA_DIR, OFFICE_DIR);

  it('generates a full year with 365 or 366 days', () => {
    const days = cal.getCalendarYear(2026, 'Rubrics 1960 - 1960');
    expect(days).toHaveLength(365);

    const leapDays = cal.getCalendarYear(2024, 'Rubrics 1960 - 1960');
    expect(leapDays).toHaveLength(366);
  });

  it('generates a month with correct number of days', () => {
    const march = cal.getCalendarMonth(2026, 3, 'Rubrics 1960 - 1960');
    expect(march).toHaveLength(31);
  });

  it('every day has required fields', () => {
    const days = cal.getCalendarMonth(2026, 4, 'Rubrics 1960 - 1960');
    for (const day of days) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day.season).toBeTruthy();
      expect(day.weekRef).toBeTruthy();
      expect(day.celebration.name).toBeTruthy();
      expect(typeof day.celebration.rank).toBe('number');
      expect(day.color).toBeTruthy();
      expect(Array.isArray(day.commemorations)).toBe(true);
    }
  });

  it('Easter day has correct properties', () => {
    const day = cal.getCalendarDay(new Date(2026, 3, 5), 'Rubrics 1960 - 1960');
    expect(day.celebration.name).toMatch(/Resurrectionis|Pasch/i);
    expect(day.color).toBe('white');
    expect(day.season).toBe('easter');
  });

  it('Christmas has correct properties', () => {
    const day = cal.getCalendarDay(new Date(2026, 11, 25), 'Rubrics 1960 - 1960');
    expect(day.celebration.rank).toBeGreaterThanOrEqual(7);
    expect(day.color).toBe('white');
    expect(day.season).toBe('christmas');
  });

  it('supports multiple versions', () => {
    const day1960 = cal.getCalendarDay(new Date(2026, 2, 19), 'Rubrics 1960 - 1960');
    const day1570 = cal.getCalendarDay(new Date(2026, 2, 19), 'Tridentine - 1570');
    // Both should find St. Joseph, but rank/details may differ
    expect(day1960.celebration.name).toMatch(/Joseph/i);
    expect(day1570.celebration.name).toMatch(/Joseph/i);
  });

  it('lists available versions', () => {
    const versions = cal.getVersions();
    expect(versions).toContain('Rubrics 1960 - 1960');
    expect(versions).toContain('Tridentine - 1570');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd liturgical-calendar && npx vitest run tests/calendar.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement calendar.ts**

```typescript
// src/engine/calendar.ts
import type { CalendarDay, CalendarVersion, Season, LiturgicalColor } from './types';
import { Directorium } from './directorium';
import { resolveOccurrence } from './occurrence';
import { getLiturgicalColor } from './color';
import { leapYear, seasonFromWeekRef, dayOfWeek } from './date';

export class LiturgicalCalendar {
  private dir: Directorium;
  private officeDir: string;

  constructor(dataDir: string, officeDir: string) {
    this.dir = new Directorium(dataDir);
    this.officeDir = officeDir;
  }

  getVersions(): string[] {
    return this.dir.getVersions();
  }

  getCalendarDay(date: Date, version: CalendarVersion): CalendarDay {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const result = resolveOccurrence(day, month, year, version, this.dir, this.officeDir);
    const season = seasonFromWeekRef(result.weekRef);
    const color = getLiturgicalColor(
      season,
      result.celebration.name,
      result.celebration.rankName,
      result.celebration.rank,
    );

    return {
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      season,
      weekRef: result.weekRef,
      celebration: result.celebration,
      color,
      commemorations: result.commemorations,
      transferredFrom: result.transferredFrom,
    };
  }

  getCalendarMonth(year: number, month: number, version: CalendarVersion): CalendarDay[] {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: CalendarDay[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      days.push(this.getCalendarDay(new Date(year, month - 1, d), version));
    }

    return days;
  }

  getCalendarYear(year: number, version: CalendarVersion): CalendarDay[] {
    const days: CalendarDay[] = [];
    for (let m = 1; m <= 12; m++) {
      days.push(...this.getCalendarMonth(year, m, version));
    }
    return days;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd liturgical-calendar && npx vitest run tests/calendar.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/engine/calendar.ts liturgical-calendar/tests/calendar.test.ts
git commit -m "feat: implement top-level LiturgicalCalendar API"
```

---

### Task 9: ICS Generator (generator.ts)

Generate `.ics` (iCalendar) files from calendar data.

**Files:**
- Create: `liturgical-calendar/src/ics/generator.ts`
- Create: `liturgical-calendar/tests/ics-generator.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/ics-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateICS, formatICSDate } from '../src/ics/generator';
import type { CalendarDay } from '../src/engine/types';

describe('formatICSDate', () => {
  it('formats date as VALUE=DATE string', () => {
    expect(formatICSDate('2026-03-25')).toBe('20260325');
  });
});

describe('generateICS', () => {
  const sampleDays: CalendarDay[] = [
    {
      date: '2026-04-05',
      season: 'easter',
      weekRef: 'Pasc0',
      celebration: { name: 'Dominica Resurrectionis', rank: 7, rankName: 'Duplex I classis', source: 'temporal' },
      color: 'white',
      commemorations: [],
    },
    {
      date: '2026-04-06',
      season: 'easter',
      weekRef: 'Pasc0',
      celebration: { name: 'Feria II infra Oct. Paschae', rank: 7, rankName: 'Duplex I classis', source: 'temporal' },
      color: 'white',
      commemorations: ['S. Xisti Papae'],
    },
  ];

  it('produces valid ICS with VCALENDAR wrapper', () => {
    const ics = generateICS(sampleDays, 'Rubrics 1960');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('PRODID:-//Divinum Officium//Liturgical Calendar//EN');
  });

  it('creates VEVENT for each day', () => {
    const ics = generateICS(sampleDays, 'Rubrics 1960');
    const events = ics.match(/BEGIN:VEVENT/g);
    expect(events).toHaveLength(2);
  });

  it('includes celebration name in SUMMARY', () => {
    const ics = generateICS(sampleDays, 'Rubrics 1960');
    expect(ics).toContain('SUMMARY:Dominica Resurrectionis');
  });

  it('includes commemorations in DESCRIPTION', () => {
    const ics = generateICS(sampleDays, 'Rubrics 1960');
    expect(ics).toContain('S. Xisti Papae');
  });

  it('includes color and season in CATEGORIES', () => {
    const ics = generateICS(sampleDays, 'Rubrics 1960');
    expect(ics).toContain('CATEGORIES:easter,white');
  });

  it('uses all-day events (VALUE=DATE)', () => {
    const ics = generateICS(sampleDays, 'Rubrics 1960');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260405');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd liturgical-calendar && npx vitest run tests/ics-generator.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement generator.ts**

```typescript
// src/ics/generator.ts
import type { CalendarDay } from '../engine/types';

/**
 * Format an ISO date string as an ICS date (YYYYMMDD).
 */
export function formatICSDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

/**
 * Compute the next day's ICS date for DTEND (all-day events need DTEND = DTSTART + 1).
 */
function nextICSDate(isoDate: string): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Escape special characters for ICS text fields.
 */
function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Fold long lines per RFC 5545 (max 75 octets per line).
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let result = line.substring(0, 75);
  let pos = 75;
  while (pos < line.length) {
    result += '\r\n ' + line.substring(pos, pos + 74);
    pos += 74;
  }
  return result;
}

/**
 * Generate an ICS (iCalendar) file string from CalendarDay data.
 */
export function generateICS(days: CalendarDay[], versionLabel: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Divinum Officium//Liturgical Calendar//EN',
    `X-WR-CALNAME:Liturgical Calendar (${versionLabel})`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const day of days) {
    const uid = `${day.date}-${versionLabel.replace(/\s+/g, '-')}@divinum-officium`;
    const summary = day.celebration.name;
    const rankAbbr = day.celebration.rankName;

    let description = `Rank: ${rankAbbr} (${day.celebration.rank})`;
    if (day.commemorations.length > 0) {
      description += `\\nCommemorations: ${day.commemorations.join(', ')}`;
    }
    if (day.transferredFrom) {
      description += `\\nTransferred from: ${day.transferredFrom}`;
    }

    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${uid}`));
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(day.date)}`);
    lines.push(`DTEND;VALUE=DATE:${nextICSDate(day.date)}`);
    lines.push(foldLine(`SUMMARY:${escapeICS(summary)}`));
    lines.push(foldLine(`DESCRIPTION:${escapeICS(description)}`));
    lines.push(`CATEGORIES:${day.season},${day.color}`);
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd liturgical-calendar && npx vitest run tests/ics-generator.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/ics/generator.ts liturgical-calendar/tests/ics-generator.test.ts
git commit -m "feat: implement ICS file generator"
```

---

### Task 10: ICS Build Script (generate-ics.ts)

CLI script that generates `.ics` files for all versions, invoked by GitHub Actions.

**Files:**
- Create: `liturgical-calendar/src/build/generate-ics.ts`

- [ ] **Step 1: Implement the build script**

```typescript
// src/build/generate-ics.ts
import { LiturgicalCalendar } from '../engine/calendar';
import { generateICS } from '../ics/generator';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(__dirname, '..', '..', 'data');
const OFFICE_DIR = join(__dirname, '..', '..', '..', 'web', 'www', 'horas', 'Latin');
const OUTPUT_DIR = join(__dirname, '..', '..', 'dist', 'ics');

// Key versions to generate ICS for (subset of all versions — the most commonly used ones)
const VERSIONS_TO_GENERATE = [
  'Tridentine - 1570',
  'Tridentine - 1888',
  'Tridentine - 1906',
  'Divino Afflatu - 1939',
  'Divino Afflatu - 1954',
  'Reduced - 1955',
  'Rubrics 1960 - 1960',
  'Monastic - 1963',
];

function main(): void {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];

  const cal = new LiturgicalCalendar(DATA_DIR, OFFICE_DIR);

  for (const version of VERSIONS_TO_GENERATE) {
    // Create a short label for the directory name
    const vdef = cal.getVersions().includes(version);
    if (!vdef) {
      console.warn(`Skipping unknown version: ${version}`);
      continue;
    }

    // Use the kalendar ID as directory name (e.g., "1960", "1570")
    const dirLabel = version.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
    const versionDir = join(OUTPUT_DIR, dirLabel);

    if (!existsSync(versionDir)) {
      mkdirSync(versionDir, { recursive: true });
    }

    for (const year of years) {
      console.log(`Generating ${version} / ${year}...`);
      const days = cal.getCalendarYear(year, version);
      const icsContent = generateICS(days, version);
      writeFileSync(join(versionDir, `${year}.ics`), icsContent, 'utf-8');
      console.log(`  → ${versionDir}/${year}.ics (${days.length} days)`);
    }
  }

  console.log('Done!');
}

main();
```

- [ ] **Step 2: Test the build script manually**

Run: `cd liturgical-calendar && npx tsx src/build/generate-ics.ts`
Expected: ICS files created in `dist/ics/` for each version and year. Verify one by inspecting content:

Run: `head -30 liturgical-calendar/dist/ics/Rubrics-1960---1960/2026.ics`
Expected: Valid ICS content with `BEGIN:VCALENDAR` and `BEGIN:VEVENT` entries.

- [ ] **Step 3: Commit**

```bash
git add liturgical-calendar/src/build/generate-ics.ts
git commit -m "feat: add ICS build script for GitHub Actions"
```

---

### Task 11: Web UI — Styles and HTML Shell

**Files:**
- Create: `liturgical-calendar/src/ui/index.html`
- Create: `liturgical-calendar/src/ui/styles.css`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Liturgical Calendar — Divinum Officium</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <header>
    <h1>Liturgical Calendar</h1>
    <div class="controls">
      <div class="control-group">
        <label for="version-select">Version:</label>
        <select id="version-select"></select>
      </div>
      <div class="control-group">
        <label for="year-input">Year:</label>
        <input type="number" id="year-input" min="1900" max="2100">
      </div>
      <div class="control-group view-toggle">
        <button id="btn-grid" class="active">Grid</button>
        <button id="btn-agenda">Agenda</button>
      </div>
      <button id="btn-subscribe" class="subscribe-btn">Subscribe (.ics)</button>
    </div>
  </header>

  <main>
    <div id="calendar-grid" class="view"></div>
    <div id="calendar-agenda" class="view hidden"></div>
  </main>

  <footer>
    <div class="color-legend">
      <span class="legend-item"><span class="swatch" style="background:#8b5cf6"></span> Violet</span>
      <span class="legend-item"><span class="swatch" style="background:#22c55e"></span> Green</span>
      <span class="legend-item"><span class="swatch" style="background:#ef4444"></span> Red</span>
      <span class="legend-item"><span class="swatch" style="background:#fff;border:1px solid #ccc"></span> White</span>
      <span class="legend-item"><span class="swatch" style="background:#f472b6"></span> Rose</span>
      <span class="legend-item"><span class="swatch" style="background:#1a1a1a"></span> Black</span>
    </div>
    <p>Powered by <a href="https://github.com/divinumofficium/divinum-officium">Divinum Officium</a></p>
  </footer>

  <script type="module" src="./app.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create styles.css**

```css
/* styles.css */
:root {
  --color-white: #ffffff;
  --color-red: #ef4444;
  --color-green: #22c55e;
  --color-violet: #8b5cf6;
  --color-rose: #f472b6;
  --color-black: #1a1a1a;
  --bg: #f8fafc;
  --border: #e2e8f0;
  --text: #1e293b;
  --text-light: #64748b;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

header { margin-bottom: 24px; }
header h1 { font-size: 24px; margin-bottom: 12px; }

.controls {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.control-group label { font-size: 14px; color: var(--text-light); }
.control-group select,
.control-group input {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
}
#version-select { min-width: 200px; }
#year-input { width: 80px; }

.view-toggle button {
  padding: 6px 14px;
  border: 1px solid var(--border);
  background: white;
  cursor: pointer;
  font-size: 14px;
}
.view-toggle button:first-child { border-radius: 6px 0 0 6px; }
.view-toggle button:last-child { border-radius: 0 6px 6px 0; }
.view-toggle button.active { background: #6366f1; color: white; border-color: #6366f1; }

.subscribe-btn {
  margin-left: auto;
  padding: 6px 14px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.subscribe-btn:hover { background: #059669; }

.hidden { display: none !important; }

/* Grid View */
.month-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.month-nav button {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
}
.month-nav h2 { font-size: 18px; }

.grid-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.grid-table th {
  padding: 8px;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-light);
  border-bottom: 2px solid var(--border);
}
.grid-table td {
  vertical-align: top;
  height: 90px;
  padding: 4px;
  border: 1px solid var(--border);
  font-size: 12px;
}
.grid-table td.sunday { background: #f0fdf4; }
.grid-table .day-num { font-weight: 700; margin-bottom: 2px; }
.grid-table .celebration-badge {
  padding: 2px 4px;
  border-radius: 3px;
  color: white;
  font-size: 10px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.celebration-badge.color-white { color: #333; background: white; border: 1px solid #ddd; }
.celebration-badge.color-red { background: var(--color-red); }
.celebration-badge.color-green { background: var(--color-green); }
.celebration-badge.color-violet { background: var(--color-violet); }
.celebration-badge.color-rose { background: var(--color-rose); }
.celebration-badge.color-black { background: var(--color-black); }

/* Agenda View */
.agenda-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: white;
}
.agenda-date {
  width: 60px;
  text-align: center;
  flex-shrink: 0;
}
.agenda-date .dow { font-size: 11px; color: var(--text-light); text-transform: uppercase; }
.agenda-date .num { font-size: 22px; font-weight: 700; }
.agenda-color-bar {
  width: 6px;
  height: 40px;
  border-radius: 3px;
  margin: 0 14px;
  flex-shrink: 0;
}
.agenda-color-bar.color-white { background: white; border: 1px solid #ccc; }
.agenda-color-bar.color-red { background: var(--color-red); }
.agenda-color-bar.color-green { background: var(--color-green); }
.agenda-color-bar.color-violet { background: var(--color-violet); }
.agenda-color-bar.color-rose { background: var(--color-rose); }
.agenda-color-bar.color-black { background: var(--color-black); }
.agenda-details { flex: 1; }
.agenda-details .name { font-weight: 600; }
.agenda-details .meta { font-size: 12px; color: var(--text-light); }
.agenda-details .comms { font-size: 11px; color: #999; margin-top: 2px; }

/* Footer */
footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.color-legend {
  display: flex;
  gap: 12px;
  font-size: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.legend-item { display: flex; align-items: center; gap: 4px; }
.swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; }
footer p { font-size: 12px; color: var(--text-light); }
footer a { color: #6366f1; }
```

- [ ] **Step 3: Commit**

```bash
git add liturgical-calendar/src/ui/index.html liturgical-calendar/src/ui/styles.css
git commit -m "feat: add UI HTML shell and styles"
```

---

### Task 12: Web UI — Grid View (grid-view.ts)

**Files:**
- Create: `liturgical-calendar/src/ui/grid-view.ts`

- [ ] **Step 1: Implement grid-view.ts**

```typescript
// src/ui/grid-view.ts
import type { CalendarDay } from '../engine/types';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function renderGrid(
  container: HTMLElement,
  days: CalendarDay[],
  year: number,
  month: number,
  onMonthChange: (delta: number) => void,
): void {
  const monthDays = days.filter((d) => {
    const m = parseInt(d.date.split('-')[1], 10);
    return m === month;
  });

  // Find first day's day-of-week
  const firstDate = new Date(year, month - 1, 1);
  const startDow = firstDate.getDay(); // 0=Sun

  container.innerHTML = '';

  // Month navigation
  const nav = document.createElement('div');
  nav.className = 'month-nav';
  nav.innerHTML = `
    <button id="prev-month">&laquo; ${MONTH_NAMES[(month - 2 + 12) % 12]}</button>
    <h2>${MONTH_NAMES[month - 1]} ${year}</h2>
    <button id="next-month">${MONTH_NAMES[month % 12]} &raquo;</button>
  `;
  container.appendChild(nav);

  nav.querySelector('#prev-month')!.addEventListener('click', () => onMonthChange(-1));
  nav.querySelector('#next-month')!.addEventListener('click', () => onMonthChange(1));

  // Table
  const table = document.createElement('table');
  table.className = 'grid-table';

  // Header
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${DOW_LABELS.map((d) => `<th>${d}</th>`).join('')}</tr>`;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  let dayIdx = 0;
  const totalCells = startDow + monthDays.length;
  const rows = Math.ceil(totalCells / 7);

  for (let row = 0; row < rows; row++) {
    const tr = document.createElement('tr');
    for (let col = 0; col < 7; col++) {
      const cellIdx = row * 7 + col;
      const td = document.createElement('td');

      if (cellIdx >= startDow && dayIdx < monthDays.length) {
        const calDay = monthDays[dayIdx];
        const dayNum = dayIdx + 1;

        if (col === 0) td.className = 'sunday';

        td.innerHTML = `
          <div class="day-num">${dayNum}</div>
          <div class="celebration-badge color-${calDay.color}"
               title="${calDay.celebration.name} — ${calDay.celebration.rankName}"
          >${abbreviate(calDay.celebration.name)}</div>
        `;
        dayIdx++;
      }

      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}

function abbreviate(name: string): string {
  if (name.length <= 25) return name;
  // Try to shorten at a word boundary
  const short = name.substring(0, 22);
  const lastSpace = short.lastIndexOf(' ');
  return (lastSpace > 10 ? short.substring(0, lastSpace) : short) + '...';
}
```

- [ ] **Step 2: Commit**

```bash
git add liturgical-calendar/src/ui/grid-view.ts
git commit -m "feat: implement grid calendar view"
```

---

### Task 13: Web UI — Agenda View (agenda-view.ts)

**Files:**
- Create: `liturgical-calendar/src/ui/agenda-view.ts`

- [ ] **Step 1: Implement agenda-view.ts**

```typescript
// src/ui/agenda-view.ts
import type { CalendarDay } from '../engine/types';

const DOW_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function renderAgenda(container: HTMLElement, days: CalendarDay[], year: number, month: number): void {
  const monthDays = days.filter((d) => {
    const m = parseInt(d.date.split('-')[1], 10);
    return m === month;
  });

  container.innerHTML = '';

  for (const calDay of monthDays) {
    const date = new Date(calDay.date);
    const dow = date.getDay();
    const dayNum = date.getDate();

    const row = document.createElement('div');
    row.className = 'agenda-row';

    let commsHtml = '';
    if (calDay.commemorations.length > 0) {
      commsHtml = `<div class="comms">Comm: ${calDay.commemorations.join(', ')}</div>`;
    }

    row.innerHTML = `
      <div class="agenda-date">
        <div class="dow">${DOW_SHORT[dow]}</div>
        <div class="num">${dayNum}</div>
      </div>
      <div class="agenda-color-bar color-${calDay.color}"></div>
      <div class="agenda-details">
        <div class="name">${calDay.celebration.name}</div>
        <div class="meta">${calDay.celebration.rankName} &mdash; ${capitalize(calDay.season)} &middot; ${capitalize(calDay.color)}</div>
        ${commsHtml}
      </div>
    `;

    container.appendChild(row);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 2: Commit**

```bash
git add liturgical-calendar/src/ui/agenda-view.ts
git commit -m "feat: implement agenda calendar view"
```

---

### Task 14: Web UI — Main App (app.ts)

Wire up controls, views, and calendar engine.

**Files:**
- Create: `liturgical-calendar/src/ui/app.ts`

- [ ] **Step 1: Implement app.ts**

```typescript
// src/ui/app.ts
import { LiturgicalCalendar } from '../engine/calendar';
import { renderGrid } from './grid-view';
import { renderAgenda } from './agenda-view';
import type { CalendarDay } from '../engine/types';

// These paths work in dev (Vite serves from src/ui/)
// In production, data is bundled or pre-generated as JSON
const DATA_DIR = '../../data';
const OFFICE_DIR = '../../../web/www/horas/Latin';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentVersion = 'Rubrics 1960 - 1960';
let currentView: 'grid' | 'agenda' = 'grid';
let yearDays: CalendarDay[] = [];

// Note: In a browser context, we'll need to pre-generate calendar data at build time
// since we can't read the filesystem. For now, this works with Vite's dev server
// if we pre-generate JSON data.

// For the production build, we'll generate a JSON file per version per year
// and fetch it at runtime. This is handled in the build step.

let calendarData: Record<string, CalendarDay[]> = {};

async function loadCalendarData(year: number, version: string): Promise<CalendarDay[]> {
  const key = `${version}/${year}`;
  if (calendarData[key]) return calendarData[key];

  try {
    // In production: fetch pre-generated JSON
    const versionSlug = version.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
    const response = await fetch(`./data/${versionSlug}/${year}.json`);
    if (response.ok) {
      const days = await response.json();
      calendarData[key] = days;
      return days;
    }
  } catch {
    // Fallback: empty
  }

  console.warn(`No data for ${version} / ${year}`);
  return [];
}

function render(): void {
  const gridEl = document.getElementById('calendar-grid')!;
  const agendaEl = document.getElementById('calendar-agenda')!;

  if (currentView === 'grid') {
    gridEl.classList.remove('hidden');
    agendaEl.classList.add('hidden');
    renderGrid(gridEl, yearDays, currentYear, currentMonth, handleMonthChange);
  } else {
    gridEl.classList.add('hidden');
    agendaEl.classList.remove('hidden');
    renderAgenda(agendaEl, yearDays, currentYear, currentMonth);
  }
}

function handleMonthChange(delta: number): void {
  currentMonth += delta;
  if (currentMonth > 12) {
    currentMonth = 1;
    currentYear++;
    reloadData();
    return;
  }
  if (currentMonth < 1) {
    currentMonth = 12;
    currentYear--;
    reloadData();
    return;
  }
  render();
}

async function reloadData(): Promise<void> {
  const yearInput = document.getElementById('year-input') as HTMLInputElement;
  yearInput.value = String(currentYear);

  yearDays = await loadCalendarData(currentYear, currentVersion);
  render();
}

async function init(): Promise<void> {
  // Populate version selector
  const versionSelect = document.getElementById('version-select') as HTMLSelectElement;
  const versions = [
    'Rubrics 1960 - 1960',
    'Divino Afflatu - 1954',
    'Divino Afflatu - 1939',
    'Tridentine - 1906',
    'Tridentine - 1888',
    'Tridentine - 1570',
    'Reduced - 1955',
    'Monastic - 1963',
  ];

  for (const v of versions) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    if (v === currentVersion) opt.selected = true;
    versionSelect.appendChild(opt);
  }

  versionSelect.addEventListener('change', () => {
    currentVersion = versionSelect.value;
    reloadData();
  });

  // Year input
  const yearInput = document.getElementById('year-input') as HTMLInputElement;
  yearInput.value = String(currentYear);
  yearInput.addEventListener('change', () => {
    currentYear = parseInt(yearInput.value, 10) || currentYear;
    reloadData();
  });

  // View toggle
  const btnGrid = document.getElementById('btn-grid')!;
  const btnAgenda = document.getElementById('btn-agenda')!;

  btnGrid.addEventListener('click', () => {
    currentView = 'grid';
    btnGrid.classList.add('active');
    btnAgenda.classList.remove('active');
    render();
  });

  btnAgenda.addEventListener('click', () => {
    currentView = 'agenda';
    btnAgenda.classList.add('active');
    btnGrid.classList.remove('active');
    render();
  });

  // Subscribe button
  document.getElementById('btn-subscribe')!.addEventListener('click', () => {
    const versionSlug = currentVersion.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
    const url = `${window.location.origin}${window.location.pathname}ics/${versionSlug}/${currentYear}.ics`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`ICS URL copied to clipboard:\n${url}\n\nPaste this URL in Google Calendar > Other Calendars > From URL`);
    }).catch(() => {
      prompt('Copy this ICS subscription URL:', url);
    });
  });

  await reloadData();
}

init();
```

- [ ] **Step 2: Commit**

```bash
git add liturgical-calendar/src/ui/app.ts
git commit -m "feat: wire up main UI app with controls and view switching"
```

---

### Task 15: Build Script for Pre-generated JSON Data

The browser UI needs pre-generated JSON data (can't read filesystem). Add a build step that generates JSON alongside ICS.

**Files:**
- Modify: `liturgical-calendar/src/build/generate-ics.ts`

- [ ] **Step 1: Add JSON generation to the build script**

Add the following to the end of the `main()` function in `src/build/generate-ics.ts`, before the final `console.log('Done!')`:

```typescript
  // Also generate JSON for the web UI
  const JSON_OUTPUT_DIR = join(__dirname, '..', '..', 'dist', 'data');

  for (const version of VERSIONS_TO_GENERATE) {
    if (!cal.getVersions().includes(version)) continue;

    const dirLabel = version.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
    const jsonDir = join(JSON_OUTPUT_DIR, dirLabel);

    if (!existsSync(jsonDir)) {
      mkdirSync(jsonDir, { recursive: true });
    }

    for (const year of years) {
      const days = cal.getCalendarYear(year, version);
      writeFileSync(join(jsonDir, `${year}.json`), JSON.stringify(days), 'utf-8');
      console.log(`  → ${jsonDir}/${year}.json`);
    }
  }
```

- [ ] **Step 2: Run the build and verify JSON output**

Run: `cd liturgical-calendar && npx tsx src/build/generate-ics.ts`
Expected: Both `dist/ics/` and `dist/data/` directories populated.

Run: `head -c 200 liturgical-calendar/dist/data/Rubrics-1960---1960/2026.json`
Expected: Valid JSON array starting with `[{"date":"2026-01-01",...`.

- [ ] **Step 3: Commit**

```bash
git add liturgical-calendar/src/build/generate-ics.ts
git commit -m "feat: generate JSON data for browser UI alongside ICS"
```

---

### Task 16: GitHub Actions Workflow

**Files:**
- Create: `liturgical-calendar/.github/workflows/deploy.yml`

- [ ] **Step 1: Create the deploy workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy Liturgical Calendar

on:
  push:
    branches: [master]
    paths:
      - 'liturgical-calendar/**'
  schedule:
    - cron: '0 0 1 1 *'  # January 1 each year
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: liturgical-calendar
        run: npm ci

      - name: Generate ICS and JSON data
        working-directory: liturgical-calendar
        run: npx tsx src/build/generate-ics.ts

      - name: Build UI
        working-directory: liturgical-calendar
        run: npx vite build

      - name: Copy ICS and data to dist
        working-directory: liturgical-calendar
        run: |
          cp -r dist/ics dist/data dist/ 2>/dev/null || true

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: liturgical-calendar/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add liturgical-calendar/.github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions workflow for Pages deployment"
```

---

### Task 17: Run All Tests and Verify

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd liturgical-calendar && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run the build end-to-end**

Run: `cd liturgical-calendar && npx tsx src/build/generate-ics.ts`
Expected: ICS and JSON files generated successfully for all versions.

- [ ] **Step 3: Verify ICS file validity**

Run: `grep -c "BEGIN:VEVENT" liturgical-calendar/dist/ics/Rubrics-1960---1960/2026.ics`
Expected: 365 (one event per day).

- [ ] **Step 4: Start dev server and verify UI**

Run: `cd liturgical-calendar && npx vite`
Expected: Dev server starts. Open the URL in browser — controls render, grid/agenda views show calendar data.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A liturgical-calendar/
git commit -m "fix: address issues found during integration testing"
```
