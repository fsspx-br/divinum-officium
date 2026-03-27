/**
 * generate-ics.ts — CLI build script for ICS and JSON output files
 *
 * Generates liturgical calendar data for a set of pre-defined versions,
 * for the current year and the next year. JSON is generated per locale
 * (one LiturgicalCalendar instance per language directory). ICS is only
 * generated for Latin to avoid duplication.
 *
 * Output:
 *   dist/ics/{version-slug}/{year}.ics              — RFC 5545 iCalendar file (Latin only)
 *   dist/data/{locale}/{version-slug}/{year}.json    — CalendarDay[] JSON for the web UI
 *
 * Usage:
 *   npx tsx src/build/generate-ics.ts
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { LiturgicalCalendar } from '../engine/calendar';
import { generateICS } from '../ics/generator';
import type { CalendarDay } from '../engine/types';

// ---------------------------------------------------------------------------
// Path resolution (works for both ESM and CommonJS)
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths are relative to THIS script's location inside src/build/
const DATA_DIR = resolve(__dirname, '../../data');
const DIST_DIR = resolve(__dirname, '../../dist');

// ---------------------------------------------------------------------------
// Locale configuration
// ---------------------------------------------------------------------------

interface LocaleConfig {
  code: string;
  officeDir: string;
}

const LATIN_OFFICE_DIR = resolve(__dirname, '../../../web/www/horas/Latin');

const LOCALES: LocaleConfig[] = [
  { code: 'en', officeDir: resolve(__dirname, '../../../web/www/horas/English') },
  { code: 'pt', officeDir: resolve(__dirname, '../../../web/www/horas/Portugues') },
  { code: 'la', officeDir: LATIN_OFFICE_DIR },
];

// ---------------------------------------------------------------------------
// Portuguese translation map (Latin name → Portuguese)
// ---------------------------------------------------------------------------

const PT_TRANSLATIONS: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, 'pt-translations.json'), 'utf8'),
);

/** Apply Portuguese translations to celebration names and commemorations. */
function applyPtTranslations(days: CalendarDay[]): CalendarDay[] {
  return days.map((day) => ({
    ...day,
    celebration: {
      ...day.celebration,
      name: PT_TRANSLATIONS[day.celebration.name] ?? day.celebration.name,
    },
    commemorations: day.commemorations.map(
      (c) => PT_TRANSLATIONS[c] ?? c,
    ),
  }));
}

// ---------------------------------------------------------------------------
// Holy days of obligation
// ---------------------------------------------------------------------------

interface HolyDayEntry {
  date: string;  // MM-DD for fixed, or keyword for moveable
  key: string;
}

interface HolyDaysConfig {
  universal: HolyDayEntry[];
  [region: string]: HolyDayEntry[];
}

const HOLY_DAYS_CONFIG: HolyDaysConfig = JSON.parse(
  readFileSync(resolve(DATA_DIR, 'holy-days.json'), 'utf8'),
);

/** Name patterns for moveable feasts (key = date field from holy-days.json). */
const MOVEABLE_FEAST_PATTERNS: Record<string, RegExp> = {
  'ascension': /^in ascensione domini$/i,
  'corpus-christi': /^festum sanctissimi corporis christi$/i,
};

/**
 * Mark holy days of obligation on CalendarDay objects.
 * Uses fixed dates from the config + name matching for moveable feasts.
 */
function markHolyDays(days: CalendarDay[], regions: string[] = []): CalendarDay[] {
  // Collect all applicable entries: universal + selected regions
  const entries: HolyDayEntry[] = [
    ...HOLY_DAYS_CONFIG.universal,
    ...regions.flatMap((r) => HOLY_DAYS_CONFIG[r] ?? []),
  ];

  // Build set of fixed MM-DD dates
  const fixedDates = new Set<string>();
  const moveableKeys: string[] = [];
  for (const entry of entries) {
    if (/^\d{2}-\d{2}$/.test(entry.date)) {
      fixedDates.add(entry.date);
    } else {
      moveableKeys.push(entry.date);
    }
  }

  return days.map((day) => {
    const mmdd = day.date.slice(5); // "YYYY-MM-DD" → "MM-DD"
    const isSunday = new Date(day.date + 'T12:00:00').getDay() === 0;

    let isHolyDay = isSunday || fixedDates.has(mmdd);

    if (!isHolyDay) {
      for (const key of moveableKeys) {
        const pattern = MOVEABLE_FEAST_PATTERNS[key];
        if (pattern && pattern.test(day.celebration.name)) {
          isHolyDay = true;
          break;
        }
      }
    }

    return isHolyDay ? { ...day, holyDayOfObligation: true } : day;
  });
}

// ---------------------------------------------------------------------------
// Abstinence days
// ---------------------------------------------------------------------------

/** Celebration name patterns for Ash Wednesday and Good Friday. */
const ASH_WEDNESDAY_PATTERN = /cinerum|cinzas/i;
const GOOD_FRIDAY_PATTERN = /parasceve|sexta.feira santa/i;

/**
 * Mark abstinence days: every Friday + Ash Wednesday + Good Friday,
 * except Fridays that are holy days of obligation (feast overrides abstinence).
 */
function markAbstinence(days: CalendarDay[]): CalendarDay[] {
  return days.map((day) => {
    const dow = new Date(day.date + 'T12:00:00').getDay();
    const isFriday = dow === 5;
    const isAshWednesday = ASH_WEDNESDAY_PATTERN.test(day.celebration.name);
    const isGoodFriday = GOOD_FRIDAY_PATTERN.test(day.celebration.name);

    // Fridays that are holy days of obligation are exempt from abstinence
    if (isFriday && day.holyDayOfObligation && !isGoodFriday) {
      return day;
    }

    if (isFriday || isAshWednesday || isGoodFriday) {
      return { ...day, abstinence: true };
    }

    return day;
  });
}

// ---------------------------------------------------------------------------
// Versions to generate
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

/** Convert a version label to a URL/filesystem-safe slug. */
function versionSlug(version: string): string {
  return version.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];

  let totalFiles = 0;

  for (const locale of LOCALES) {
    console.log(`\n── Locale: ${locale.code} ──`);
    console.log(`  data:   ${DATA_DIR}`);
    console.log(`  office: ${locale.officeDir}`);

    const fallback = locale.officeDir !== LATIN_OFFICE_DIR ? LATIN_OFFICE_DIR : undefined;
    const calendar = new LiturgicalCalendar(DATA_DIR, locale.officeDir, fallback);

    const available = new Set(calendar.getVersions());
    const missing = VERSIONS.filter((v) => !available.has(v));
    if (missing.length > 0) {
      console.error('WARNING: the following versions are not available and will be skipped:');
      for (const v of missing) console.error(`  - ${v}`);
    }

    const validVersions = VERSIONS.filter((v) => available.has(v));

    for (const version of validVersions) {
      const slug = versionSlug(version);
      const jsonDir = resolve(DIST_DIR, 'data', locale.code, slug);
      mkdirSync(jsonDir, { recursive: true });

      // ICS only for Latin locale
      let icsDir: string | null = null;
      if (locale.code === 'la') {
        icsDir = resolve(DIST_DIR, 'ics', slug);
        mkdirSync(icsDir, { recursive: true });
      }

      for (const year of years) {
        process.stdout.write(`  [${locale.code}][${version}] ${year} … `);

        try {
          let days = calendar.getCalendarYear(year, version);

          // Mark holy days of obligation (universal + brazil)
          days = markHolyDays(days, ['brazil']);

          // Mark abstinence days (Fridays + Ash Wednesday + Good Friday)
          days = markAbstinence(days);

          // Apply Portuguese translation map
          if (locale.code === 'pt') {
            days = applyPtTranslations(days);
          }

          // Write JSON
          const jsonContent = JSON.stringify(days, null, 2);
          writeFileSync(resolve(jsonDir, `${year}.json`), jsonContent, 'utf8');
          totalFiles += 1;

          // Write ICS (Latin only)
          if (icsDir) {
            const icsContent = generateICS(days, version);
            writeFileSync(resolve(icsDir, `${year}.ics`), icsContent, 'utf8');
            totalFiles += 1;
          }

          console.log(`OK (${days.length} days)`);
        } catch (err) {
          console.error(`FAILED`);
          console.error(`    ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  console.log();
  console.log(`Done. ${totalFiles} files written to ${DIST_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
