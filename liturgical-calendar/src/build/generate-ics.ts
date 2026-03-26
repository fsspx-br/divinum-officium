/**
 * generate-ics.ts — CLI build script for ICS and JSON output files
 *
 * Generates liturgical calendar data for a set of pre-defined versions,
 * for the current year and the next year.
 *
 * Output:
 *   dist/ics/{version-slug}/{year}.ics   — RFC 5545 iCalendar file
 *   dist/data/{version-slug}/{year}.json — CalendarDay[] JSON for the web UI
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
const OFFICE_DIR = resolve(__dirname, '../../../../web/www/horas/Latin');
const DIST_DIR = resolve(__dirname, '../../dist');

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

  console.log(`Initialising LiturgicalCalendar…`);
  console.log(`  data:   ${DATA_DIR}`);
  console.log(`  office: ${OFFICE_DIR}`);
  console.log();

  const calendar = new LiturgicalCalendar(DATA_DIR, OFFICE_DIR);

  // Validate that all requested versions are available
  const available = new Set(calendar.getVersions());
  const missing = VERSIONS.filter((v) => !available.has(v));
  if (missing.length > 0) {
    console.error('WARNING: the following versions are not available and will be skipped:');
    for (const v of missing) {
      console.error(`  - ${v}`);
    }
  }

  const validVersions = VERSIONS.filter((v) => available.has(v));

  let totalFiles = 0;

  for (const version of validVersions) {
    const slug = versionSlug(version);
    const icsDir = resolve(DIST_DIR, 'ics', slug);
    const jsonDir = resolve(DIST_DIR, 'data', slug);

    mkdirSync(icsDir, { recursive: true });
    mkdirSync(jsonDir, { recursive: true });

    for (const year of years) {
      process.stdout.write(`  [${version}] ${year} … `);

      try {
        const days = calendar.getCalendarYear(year, version);

        // Write ICS
        const icsContent = generateICS(days, version);
        const icsPath = resolve(icsDir, `${year}.ics`);
        writeFileSync(icsPath, icsContent, 'utf8');

        // Write JSON
        const jsonContent = JSON.stringify(days, null, 2);
        const jsonPath = resolve(jsonDir, `${year}.json`);
        writeFileSync(jsonPath, jsonContent, 'utf8');

        const dayCount = days.length;
        console.log(`OK (${dayCount} days)`);
        totalFiles += 2;
      } catch (err) {
        console.error(`FAILED`);
        console.error(`    ${err instanceof Error ? err.message : String(err)}`);
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
