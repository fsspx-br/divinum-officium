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
import { mkdirSync, writeFileSync } from 'fs';
import { LiturgicalCalendar } from '../engine/calendar';
import { generateICS } from '../ics/generator';

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

const LOCALES: LocaleConfig[] = [
  { code: 'en', officeDir: resolve(__dirname, '../../../web/www/horas/English') },
  { code: 'pt', officeDir: resolve(__dirname, '../../../web/www/horas/Portugues') },
  { code: 'la', officeDir: resolve(__dirname, '../../../web/www/horas/Latin') },
];

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

    const calendar = new LiturgicalCalendar(DATA_DIR, locale.officeDir);

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
          const days = calendar.getCalendarYear(year, version);

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
