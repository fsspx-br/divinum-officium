/**
 * build-integration.test.ts — Integration tests for the build pipeline
 *
 * Verifies that the full calendar engine produces valid output for every
 * rubric version and locale, and that the post-processing pipeline
 * (holy days, abstinence, translations, ICS generation) works end-to-end.
 */

import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { LiturgicalCalendar } from '../src/engine/calendar';
import { generateICS } from '../src/ics/generator';
import {
  markHolyDays,
  markAbstinence,
  markEmberDays,
  applyPtTranslations,
  applyPtDateTranslations,
} from '../src/build/pipeline';
import type { HolyDaysConfig } from '../src/build/pipeline';
import type { CalendarDay } from '../src/engine/types';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = resolve(__dirname, '../data');
const LATIN_OFFICE_DIR = resolve(__dirname, '../../web/www/horas/Latin');

const LOCALES = [
  { code: 'en', officeDir: resolve(__dirname, '../../web/www/horas/English') },
  { code: 'pt', officeDir: resolve(__dirname, '../../web/www/horas/Portugues') },
  { code: 'la', officeDir: LATIN_OFFICE_DIR },
];

const VERSIONS = [
  'Tridentine - 1570',
  'Tridentine - 1888',
  'Tridentine - 1906',
  'Divino Afflatu - 1939',
  'Divino Afflatu - 1954',
  'Reduced - 1955',
  'Rubrics 1960 - 1960',
  'Monastic - 1963',
];

const HOLY_DAYS_CONFIG: HolyDaysConfig = JSON.parse(
  readFileSync(resolve(DATA_DIR, 'holy-days.json'), 'utf8'),
);

const PT_TRANSLATIONS: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, '../src/build/pt-translations.json'), 'utf8'),
);

const PT_DATE_TRANSLATIONS: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, '../src/build/pt-date-translations-2026.json'), 'utf8'),
);

const TEST_YEAR = 2026;

// ---------------------------------------------------------------------------
// Per-locale, per-version integration tests
// ---------------------------------------------------------------------------

for (const locale of LOCALES) {
  describe(`Locale: ${locale.code}`, () => {
    const fallback = locale.officeDir !== LATIN_OFFICE_DIR ? LATIN_OFFICE_DIR : undefined;
    const calendar = new LiturgicalCalendar(DATA_DIR, locale.officeDir, fallback);

    for (const version of VERSIONS) {
      describe(`Version: ${version}`, () => {
        let days: CalendarDay[];

        // Run the full pipeline once per version
        it('generates a full year of calendar data', () => {
          days = calendar.getCalendarYear(TEST_YEAR, version);
          expect(days.length).toBe(365);
        });

        it('every day has required fields', () => {
          if (!days) return;
          for (const day of days) {
            expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(day.season).toBeTruthy();
            expect(day.celebration).toBeTruthy();
            expect(day.celebration.name).toBeTruthy();
            expect(day.celebration.rankName).toBeTruthy();
            expect(typeof day.celebration.rank).toBe('number');
            expect(day.color).toMatch(/^(white|red|green|violet|rose|black)$/);
            expect(Array.isArray(day.commemorations)).toBe(true);
          }
        });

        it('days span the full year from Jan 1 to Dec 31', () => {
          if (!days) return;
          expect(days[0].date).toBe(`${TEST_YEAR}-01-01`);
          expect(days[days.length - 1].date).toBe(`${TEST_YEAR}-12-31`);
        });

        it('dates are in chronological order with no gaps', () => {
          if (!days) return;
          for (let i = 1; i < days.length; i++) {
            const prev = new Date(days[i - 1].date + 'T12:00:00');
            const curr = new Date(days[i].date + 'T12:00:00');
            const diffMs = curr.getTime() - prev.getTime();
            expect(diffMs).toBe(86400000); // exactly 1 day apart
          }
        });

        it('markHolyDays marks Sundays and fixed dates', () => {
          if (!days) return;
          const marked = markHolyDays(days, HOLY_DAYS_CONFIG, ['brazil']);

          // All Sundays should be holy days
          const sundays = marked.filter((d) => new Date(d.date + 'T12:00:00').getDay() === 0);
          for (const s of sundays) {
            expect(s.holyDayOfObligation).toBe(true);
          }

          // Christmas should be marked
          const christmas = marked.find((d) => d.date === `${TEST_YEAR}-12-25`);
          expect(christmas?.holyDayOfObligation).toBe(true);

          // Oct 12 (Brazil) should be marked
          const aparecida = marked.find((d) => d.date === `${TEST_YEAR}-10-12`);
          expect(aparecida?.holyDayOfObligation).toBe(true);
        });

        it('markAbstinence marks all Fridays (except holy day Fridays)', () => {
          if (!days) return;
          const holyMarked = markHolyDays(days, HOLY_DAYS_CONFIG, ['brazil']);
          const absMarked = markAbstinence(holyMarked);

          const fridays = absMarked.filter((d) => new Date(d.date + 'T12:00:00').getDay() === 5);

          for (const f of fridays) {
            if (f.holyDayOfObligation && !/parasceve|sexta.feira santa/i.test(f.celebration.name)) {
              // Holy day Friday (not Good Friday) — exempt
              expect(f.abstinence).toBeUndefined();
            } else {
              expect(f.abstinence).toBe(true);
            }
          }
        });

        it('markEmberDays marks exactly twelve rubric-aware dates', () => {
          if (!days) return;
          const marked = markAbstinence(markEmberDays(days, version));
          const emberDays = marked.filter((day) => day.isEmberDay);
          expect(emberDays).toHaveLength(12);
          expect(emberDays.every((day) => day.abstinence)).toBe(true);
        });

        if (locale.code === 'pt') {
          it('applyPtTranslations translates known celebration names', () => {
            if (!days) return;
            const translated = applyPtTranslations(days, PT_TRANSLATIONS);

            // Check that at least some names were translated
            let translatedCount = 0;
            for (let i = 0; i < days.length; i++) {
              if (translated[i].celebration.name !== days[i].celebration.name) {
                translatedCount++;
              }
            }
            expect(translatedCount).toBeGreaterThan(0);
          });

          it('translated days keep the same date and structure', () => {
            if (!days) return;
            const translated = applyPtTranslations(days, PT_TRANSLATIONS);
            expect(translated.length).toBe(days.length);
            for (let i = 0; i < days.length; i++) {
              expect(translated[i].date).toBe(days[i].date);
              expect(translated[i].season).toBe(days[i].season);
              expect(translated[i].color).toBe(days[i].color);
            }
          });
        }

        if (locale.code === 'la') {
          it('generates valid ICS output', () => {
            if (!days) return;
            const ics = generateICS(days, version);

            expect(ics).toContain('BEGIN:VCALENDAR');
            expect(ics).toContain('END:VCALENDAR');
            expect(ics).toContain(version);

            // One VEVENT per day
            const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
            expect(eventCount).toBe(365);

            // All UIDs are unique
            const uidLines = ics.split('\r\n').filter((l) => l.startsWith('UID:'));
            const uniqueUIDs = new Set(uidLines);
            expect(uniqueUIDs.size).toBe(365);
          });

          it('ICS uses CRLF line endings throughout', () => {
            if (!days) return;
            const ics = generateICS(days, version);
            const lines = ics.split('\n');
            for (let i = 0; i < lines.length - 1; i++) {
              expect(lines[i].endsWith('\r')).toBe(true);
            }
          });

          it('ICS has no line exceeding 75 octets', () => {
            if (!days) return;
            const ics = generateICS(days, version);
            const encoder = new TextEncoder();
            const lines = ics.split('\r\n');
            for (const line of lines) {
              expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
            }
          });
        }
      });
    }
  });
}

describe('Portuguese translation regressions', () => {
  it('translates the ASCII ae spelling of St. Bartholomew used by the Portuguese office', () => {
    const calendar = new LiturgicalCalendar(
      DATA_DIR,
      resolve(__dirname, '../../web/www/horas/Portugues'),
      LATIN_OFFICE_DIR,
    );
    const day = calendar.getCalendarDay(
      new Date(TEST_YEAR, 7, 24),
      'Rubrics 1960 - 1960',
    );

    expect(day.celebration.name).toBe('S. Bartholomaei Apostoli');
    const [translated] = applyPtTranslations([day], PT_TRANSLATIONS);
    expect(translated.celebration.name).toBe('São Bartolomeu, Apóstolo');
  });

  it('leaves no Latin-only titles in the Rubrics 1960 Portuguese calendar for 2026', () => {
    const latinCalendar = new LiturgicalCalendar(DATA_DIR, LATIN_OFFICE_DIR);
    const portugueseCalendar = new LiturgicalCalendar(
      DATA_DIR,
      resolve(__dirname, '../../web/www/horas/Portugues'),
      LATIN_OFFICE_DIR,
    );
    const version = 'Rubrics 1960 - 1960';
    const latinDays = latinCalendar.getCalendarYear(TEST_YEAR, version);
    const portugueseDays = applyPtDateTranslations(
      applyPtTranslations(portugueseCalendar.getCalendarYear(TEST_YEAR, version), PT_TRANSLATIONS),
      PT_DATE_TRANSLATIONS,
    );
    const normalize = (value: string): string => value
      .normalize('NFKD')
      .replace(/æ/giu, 'ae')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]/giu, '')
      .toLowerCase();
    const untranslated: string[] = [];

    for (let index = 0; index < latinDays.length; index++) {
      const latinDay = latinDays[index];
      const portugueseDay = portugueseDays[index];
      if (normalize(latinDay.celebration.name) === normalize(portugueseDay.celebration.name)) {
        untranslated.push(`${latinDay.date}: ${latinDay.celebration.name}`);
      }
      for (let commemorationIndex = 0;
        commemorationIndex < latinDay.commemorations.length;
        commemorationIndex++) {
        const latinName = latinDay.commemorations[commemorationIndex];
        const portugueseName = portugueseDay.commemorations[commemorationIndex];
        if (portugueseName && normalize(latinName) === normalize(portugueseName)) {
          untranslated.push(`${latinDay.date} (commemoration): ${latinName}`);
        }
      }
    }

    expect(untranslated, untranslated.join('\n')).toEqual([]);
  });
});
