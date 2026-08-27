/**
 * generate-ics.ts — CLI build script for ICS and JSON output files
 *
 * Generates liturgical calendar data for a set of pre-defined versions from
 * 2025 through 3000. JSON is generated per locale (one LiturgicalCalendar
 * instance per language directory). Distant years are gzip-compressed to keep
 * the static deployment reasonably sized; the rolling four-year window is
 * also emitted as plain JSON. ICS is generated for that rolling window only.
 *
 * Output:
 *   dist/ics/{version-slug}/{year}.ics              — RFC 5545 iCalendar file (Latin only)
 *   dist/data/{locale}/{version-slug}/{year}.json.gz — CalendarDay[] JSON (all years)
 *   dist/data/{locale}/{version-slug}/{year}.json    — plain JSON (rolling window)
 *
 * Usage:
 *   npx tsx src/build/generate-ics.ts
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { LiturgicalCalendar } from '../engine/calendar';
import { generateICS } from '../ics/generator';
import type { CalendarDay } from '../engine/types';
import { CALENDAR_START_YEAR, CALENDAR_END_YEAR, calendarYearRange } from './range';
import {
  markHolyDays,
  markAbstinence,
  markEmberDays,
  applyPtTranslations,
  applyPtDateTranslations,
} from './pipeline';
import type { HolyDaysConfig } from './pipeline';

// ---------------------------------------------------------------------------
// Path resolution (works for both ESM and CommonJS)
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths are relative to THIS script's location inside src/build/
const DATA_DIR = resolve(__dirname, '../../data');
const BRASILIA_TEMPORA_FILE = resolve(
  __dirname,
  '../../../web/www/Tabulae/Tempora/Brasilia.txt',
);
const DIST_DIR = process.env.CALENDAR_DIST_DIR
  ? resolve(process.env.CALENDAR_DIST_DIR)
  : resolve(__dirname, '../../dist');

// ---------------------------------------------------------------------------
// Locale configuration
// ---------------------------------------------------------------------------

interface LocaleConfig {
  code: string;
  officeDir: string;
}

const LATIN_OFFICE_DIR = resolve(__dirname, '../../../web/www/horas/Latin');

const LOCALES: LocaleConfig[] = [
  { code: 'pt', officeDir: resolve(__dirname, '../../../web/www/horas/Portugues') },
  { code: 'la', officeDir: LATIN_OFFICE_DIR },
];

// ---------------------------------------------------------------------------
// Portuguese translation map (Latin name → Portuguese)
// ---------------------------------------------------------------------------

const PT_TRANSLATIONS: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, 'pt-translations.json'), 'utf8'),
);

const PT_DATE_TRANSLATIONS: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, 'pt-date-translations-2026.json'), 'utf8'),
);

const PT_DATE_REFERENCE_VERSION = 'Rubrics 1960 - 1960';

const HOLY_DAYS_CONFIG: HolyDaysConfig = JSON.parse(
  readFileSync(resolve(DATA_DIR, 'holy-days.json'), 'utf8'),
);

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
  const startYear = Number(process.env.CALENDAR_START_YEAR ?? CALENDAR_START_YEAR);
  const endYear = Number(process.env.CALENDAR_END_YEAR ?? CALENDAR_END_YEAR);
  const years = calendarYearRange(startYear, endYear);
  const rollingYears = new Set([currentYear - 1, currentYear, currentYear + 1, currentYear + 2]);

  let totalFiles = 0;
  let failures = 0;

  for (const locale of LOCALES) {
    console.log(`\n── Locale: ${locale.code} ──`);
    console.log(`  data:   ${DATA_DIR}`);
    console.log(`  office: ${locale.officeDir}`);

    const fallback = locale.officeDir !== LATIN_OFFICE_DIR ? LATIN_OFFICE_DIR : undefined;
    const calendar = new LiturgicalCalendar(
      DATA_DIR,
      locale.officeDir,
      fallback,
      BRASILIA_TEMPORA_FILE,
    );

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
        const reportProgress = rollingYears.has(year)
          || year === startYear
          || year === endYear
          || year % 25 === 0;
        if (reportProgress) process.stdout.write(`  [${locale.code}][${version}] ${year} … `);

        try {
          let days = calendar.getCalendarYear(year, version);

          // Mark holy days of obligation (universal + brazil)
          days = markHolyDays(days, HOLY_DAYS_CONFIG, ['brazil']);

          // Mark the twelve Ember Days (Têmporas) using rubric-aware date rules
          days = markEmberDays(days, version);

          // Mark abstinence days, including all Ember Days
          days = markAbstinence(days);

          // Apply Portuguese translation map
          if (locale.code === 'pt') {
            days = applyPtTranslations(days, PT_TRANSLATIONS);
            if (version === PT_DATE_REFERENCE_VERSION) {
              days = applyPtDateTranslations(days, PT_DATE_TRANSLATIONS);
            }
          }

          // Write compact gzip JSON for the complete long-range dataset.
          const jsonContent = JSON.stringify(days);
          writeFileSync(resolve(jsonDir, `${year}.json.gz`), gzipSync(jsonContent));
          totalFiles += 1;

          // Keep nearby years directly inspectable and compatible with older clients.
          if (rollingYears.has(year)) {
            writeFileSync(resolve(jsonDir, `${year}.json`), JSON.stringify(days, null, 2), 'utf8');
            totalFiles += 1;
          }

          // Static per-year ICS remains a rolling window; the public combined
          // feed reads the complete compressed JSON range.
          if (icsDir && rollingYears.has(year)) {
            const icsContent = generateICS(days, version, 'la');
            writeFileSync(resolve(icsDir, `${year}.ics`), icsContent, 'utf8');
            totalFiles += 1;
          }

          if (reportProgress) console.log(`OK (${days.length} days)`);
        } catch (err) {
          failures += 1;
          if (!reportProgress) process.stderr.write(`  [${locale.code}][${version}] ${year} … `);
          console.error(`FAILED`);
          console.error(`    ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  console.log();
  if (failures > 0) {
    throw new Error(`${failures} calendar year${failures === 1 ? '' : 's'} failed to generate`);
  }
  console.log(`Done. ${totalFiles} files written to ${DIST_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
