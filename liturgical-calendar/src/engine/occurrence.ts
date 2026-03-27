/**
 * occurrence.ts — Occurrence/Precedence resolution module
 *
 * Simplified TypeScript port of the occurrence() function from horascommon.pl.
 * Given a date and version, resolves which liturgical office wins between
 * the temporal (season) and sanctoral (saints) cycles.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Celebration, ParsedRank } from './types';
import { getWeek, getSday, dayOfWeek } from './date';
import { parseRankField } from './parser';
import type { Directorium } from './directorium';

// ---------------------------------------------------------------------------
// OccurrenceResult
// ---------------------------------------------------------------------------

export interface OccurrenceResult {
  celebration: Celebration;
  weekRef: string;
  commemorations: string[];
  transferredFrom?: string;
}

// ---------------------------------------------------------------------------
// Version-matching helpers for [Rank] selection
// ---------------------------------------------------------------------------

/**
 * Map a version string to the rubrica keywords it matches in office file
 * conditional blocks like `(sed rubrica 196)` or `(rubrica tridentina)`.
 */
function versionRubricaKeys(version: string): string[] {
  const keys: string[] = [];
  const v = version.toLowerCase();

  if (v.includes('1960') || v.includes('196')) {
    keys.push('196', '1960');
  }
  if (v.includes('1955') || v.includes('reduced')) {
    keys.push('1955');
  }
  if (v.includes('divino')) {
    keys.push('divino');
  }
  if (v.includes('trident') || v.includes('1570') || v.includes('1888') || v.includes('1906')) {
    keys.push('tridentina', 'trident');
  }
  if (v.includes('monastic')) {
    keys.push('monastic');
  }
  if (v.includes('cist')) {
    keys.push('cisterciensis', 'cist');
  }
  if (v.includes('1930')) {
    keys.push('1930');
  }
  if (v.includes('1963')) {
    keys.push('1963');
  }
  if (v.includes('innovata') || v.includes('newcal') || v.includes('2020')) {
    keys.push('innovata');
  }

  return keys;
}

/**
 * Check if a condition like `(sed rubrica 196 aut rubrica tridentina)` or
 * `(rubrica 196)` matches the given version.
 *
 * Supports `aut` (OR) and `nisi` (NOT) connectives.
 */
function conditionMatchesVersion(condition: string, version: string): boolean {
  const keys = versionRubricaKeys(version);
  if (keys.length === 0) return false;

  const lower = condition.toLowerCase();

  // Split on 'aut' to get OR-alternatives
  const alternatives = lower.split(/\s+aut\s+/);

  for (const alt of alternatives) {
    // Check for 'nisi' (except) clauses
    const nisiParts = alt.split(/\s+nisi\s+/);
    const mainPart = nisiParts[0];
    const exceptParts = nisiParts.slice(1);

    // Check if the main part matches any of our keys
    const mainMatches = keys.some(k => mainPart.includes(k));
    if (!mainMatches) continue;

    // Check nisi (except) clauses — if any nisi clause matches, this alternative is excluded
    const excluded = exceptParts.some(ep => keys.some(k => ep.includes(k)));
    if (!excluded) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Read [Rank] from office file
// ---------------------------------------------------------------------------

/**
 * Read the [Rank] field from an office file, selecting the version-appropriate
 * variant if multiple are present.
 *
 * Files may contain multiple [Rank] sections with version conditions:
 *   [Rank]
 *   ;;Duplex I classis;;7
 *   (sed rubrica 196)
 *   ;;Duplex I classis;;6
 *
 * The logic: Start with the base [Rank] line, then if a `(sed rubrica ...)` or
 * `(rubrica ...)` condition matches the version, use the line following it instead.
 */
export function getRankFromFile(officeDir: string, filename: string, version: string, depth = 0): string {
  if (depth > 5) return ''; // Prevent infinite redirect loops

  const filePath = resolve(officeDir, filename.endsWith('.txt') ? filename : `${filename}.txt`);

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }

  // Handle file-level @redirect: first line starts with "@SomeOther/File"
  // Some files have @ on first line followed by additional content (e.g. Quad6-6r.txt)
  const firstLine = content.split('\n')[0].trim();
  if (firstLine.startsWith('@')) {
    const redirectTarget = firstLine.slice(1).trim();
    return getRankFromFile(officeDir, redirectTarget, version, depth + 1);
  }

  const lines = content.split('\n');

  // Find all [Rank] sections. There may be multiple: [Rank] and [Rank] (rubrica ...)
  // Strategy: collect base rank and conditional overrides
  let baseRank = '';
  let selectedRank = '';
  let inRankSection = false;
  let conditionForNext: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect [Rank] header — possibly with a condition
    const rankHeaderMatch = line.match(/^\[Rank\]\s*(?:\((.+?)\))?$/);
    if (rankHeaderMatch) {
      const headerCondition = rankHeaderMatch[1] || null;

      if (headerCondition) {
        // This is a separate [Rank] (rubrica ...) section
        if (conditionMatchesVersion(headerCondition, version)) {
          // Read the next non-empty, non-condition line as the rank
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim();
            if (!nextLine || nextLine.startsWith('(')) continue;
            if (nextLine.startsWith('[')) break;
            selectedRank = nextLine;
            break;
          }
        }
      } else {
        // Base [Rank] section
        inRankSection = true;
        conditionForNext = null;
        continue;
      }
      continue;
    }

    if (!inRankSection) continue;

    // End of section on next [Section] header
    if (line.startsWith('[') && !line.startsWith('[Rank]')) {
      inRankSection = false;
      continue;
    }

    // Empty line — skip
    if (!line) continue;

    // Condition line like `(sed rubrica 196)`
    const condMatch = line.match(/^\((?:sed\s+)?(.+?)\)$/);
    if (condMatch) {
      conditionForNext = condMatch[1];
      continue;
    }

    // This is a rank value line
    if (conditionForNext !== null) {
      // This line is conditional on conditionForNext
      if (conditionMatchesVersion(conditionForNext, version)) {
        selectedRank = line;
      }
      conditionForNext = null;
    } else if (!baseRank) {
      // First unconditional line is the base rank
      baseRank = line;
    }
  }

  return selectedRank || baseRank;
}

// ---------------------------------------------------------------------------
// resolveOccurrence
// ---------------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // 1. Build temporal reference
  // -----------------------------------------------------------------------
  const isNat = weekRef.startsWith('Nat');
  const tday = `Tempora/${weekRef}${isNat ? '' : `-${dow}`}`;

  // Check for permanent tempora redirects
  const temporaRedirect = dir.getFromDirektorium('tempora', version, tday);
  let tfile = temporaRedirect || tday;

  // Check for annual transfers of the temporal office
  const transferTempora = dir.getFromDirektorium('tempora', version, sday);
  if (transferTempora && /tempora/i.test(transferTempora) && !dir.isTransferred(transferTempora, year, version)) {
    tfile = transferTempora;
  }

  // Check if temporal office has been transferred away
  let transferredFrom: string | undefined;
  if (dir.isTransferred(tfile, year, version)) {
    transferredFrom = tfile;
    tfile = '';
  }

  // -----------------------------------------------------------------------
  // 2. Read temporal rank
  // -----------------------------------------------------------------------
  let tRankStr = '';
  let tParsed: ParsedRank = { name: '', rankType: '', numericRank: 0 };

  if (tfile) {
    tRankStr = getRankFromFile(officeDir, tfile, version);
    if (tRankStr) {
      tParsed = parseRankField(tRankStr);
      // If the [Rank] name field is empty, populate from [Officium]
      if (!tParsed.name) {
        tParsed = { ...tParsed, name: extractNameFromFile(officeDir, tfile) };
      }
    }
  }

  // -----------------------------------------------------------------------
  // 3. Build sanctoral reference
  // -----------------------------------------------------------------------
  const kalEntry = dir.getFromDirektorium('kalendar', version, sday);
  let sfile = '';
  const commemoCandidates: string[] = [];

  if (kalEntry) {
    // kalEntry is everything after the day key's first '='.
    // It may contain multiple '~'-separated sub-entries.
    // Each sub-entry format: fileRef=Name=rank=... (only fileRef matters)
    // Or it may just be a simple fileRef like "06-14" or "Sancti/06-14"
    const tildeEntries = kalEntry.split('~');

    for (let i = 0; i < tildeEntries.length; i++) {
      const entry = tildeEntries[i].trim();
      if (!entry || entry === 'XXXXX') continue;

      // Extract fileRef: the part before the first '=' (if any)
      const eqIdx = entry.indexOf('=');
      const fileRef = eqIdx === -1 ? entry : entry.slice(0, eqIdx).trim();
      if (!fileRef || fileRef === 'XXXXX') continue;

      const fullRef = /tempora/i.test(fileRef) ? fileRef : `Sancti/${fileRef}`;

      if (i === 0) {
        sfile = fullRef;
      } else {
        commemoCandidates.push(fullRef);
      }
    }
  }

  // Check annual sanctoral transfers
  const transferSancti = dir.getFromDirektorium('transfer', version, sday, year);
  if (transferSancti) {
    const transferParts = transferSancti.split('~');
    const primary = transferParts[0].trim();
    if (primary) {
      // Extract fileRef from transfer entry
      const eqIdx = primary.indexOf('=');
      const fileRef = eqIdx === -1 ? primary : primary.slice(0, eqIdx).trim();
      if (fileRef && !/tempora/i.test(fileRef)) {
        sfile = /sancti/i.test(fileRef) ? fileRef : `Sancti/${fileRef}`;
      }
    }
  }

  // Check if sanctoral feast has been transferred away
  if (sfile && dir.isTransferred(sfile, year, version)) {
    transferredFrom = sfile;
    sfile = '';
  }

  // -----------------------------------------------------------------------
  // 4. Read sanctoral rank
  // -----------------------------------------------------------------------
  let sRankStr = '';
  let sParsed: ParsedRank = { name: '', rankType: '', numericRank: 0 };

  if (sfile) {
    sRankStr = getRankFromFile(officeDir, sfile, version);
    if (sRankStr) {
      sParsed = parseRankField(sRankStr);
      if (!sParsed.name) {
        sParsed = { ...sParsed, name: extractNameFromFile(officeDir, sfile) };
      }
    }
  }

  // -----------------------------------------------------------------------
  // 5. Apply version-specific Sunday rank adjustments
  // -----------------------------------------------------------------------
  const isSunday = dow === 0 || /dominica/i.test(tParsed.name);

  if (isSunday && tParsed.numericRank > 0) {
    const vLower = version.toLowerCase();
    if (/trident/i.test(vLower) && !(/altovadensis/i.test(vLower)) && !(/cist/i.test(vLower))) {
      // Before Divino: minor Sundays reduced to 2.9
      if (tParsed.numericRank < 5.1 && tParsed.numericRank > 4.2) {
        tParsed = { ...tParsed, numericRank: 2.9 };
      }
    } else if (/divino/i.test(vLower)) {
      // Divino Afflatu: minor Sundays raised to 4.9
      if (tParsed.numericRank < 5.1) {
        tParsed = { ...tParsed, numericRank: 4.9 };
      }
    }
  }

  // -----------------------------------------------------------------------
  // 6. Apply suppression rules — high temporal suppresses low sanctoral
  // -----------------------------------------------------------------------
  const vIs1960 = /196/.test(version);
  const vIs1955 = /1955/.test(version) || (/monastic/i.test(version) && /divino/i.test(version));

  // High temporal rank suppresses low sanctoral
  if (
    (tParsed.numericRank >= ((vIs1960 || vIs1955) ? 6 : 7) && sParsed.numericRank < 6) ||
    (tParsed.numericRank >= 6 && sParsed.numericRank < 2.1 && !isSunday && !/feria|sabbato|in octava/i.test(tParsed.name))
  ) {
    sRankStr = '';
    sParsed = { name: '', rankType: '', numericRank: 0 };
    sfile = '';
  }

  // 1960: on Sundays, I cl suppresses < I cl, II cl suppresses < II cl
  if (vIs1960 && isSunday) {
    if (
      (tParsed.numericRank >= 6 && sParsed.numericRank < 6) ||
      (tParsed.numericRank >= 5 && sParsed.numericRank < 5)
    ) {
      sRankStr = '';
      sParsed = { name: '', rankType: '', numericRank: 0 };
      sfile = '';
    }
  }

  // 1960: high sanctoral suppresses low temporal (except privileged days)
  if (
    vIs1960 &&
    sParsed.numericRank >= 6 &&
    tParsed.numericRank < 6 &&
    tParsed.numericRank !== 2.1 &&
    tParsed.numericRank !== 3.9 &&
    tParsed.numericRank !== 4.9 &&
    !isSunday
  ) {
    tRankStr = '';
    tParsed = { name: '', rankType: '', numericRank: 0 };
    tfile = '';
  }

  // -----------------------------------------------------------------------
  // 7. Determine winner (occurrence resolution)
  // -----------------------------------------------------------------------
  let sanctoralWins = false;

  if (!sParsed.numericRank || ((vIs1960 || vIs1955) && sParsed.numericRank <= 1.1)) {
    // No valid sanctoral office or reduced to commemoration
    sanctoralWins = false;
  } else if (sParsed.numericRank > tParsed.numericRank) {
    // Main case: sanctoral outranks temporal
    sanctoralWins = true;
  } else if (isSunday) {
    // Sunday special rules
    if (vIs1960) {
      // 1960: II cl feasts of the Lord + all I cl beat II cl Sundays
      if (tParsed.numericRank <= 5 && (sParsed.numericRank >= 6 || sParsed.numericRank >= 5)) {
        sanctoralWins = true;
      }
    } else {
      // Pre-1960: feasts of the Lord with sufficient rank beat minor Sundays
      if (sParsed.numericRank >= 2 && tParsed.numericRank <= 5) {
        // This is a simplified check; the full logic checks Rule for "Festum Domini"
        sanctoralWins = false; // Conservative: let temporal win on Sundays pre-1960 by default
      }
    }
  }

  // -----------------------------------------------------------------------
  // 8. Build result
  // -----------------------------------------------------------------------
  const commemorations: string[] = [];

  if (sanctoralWins) {
    // Sanctoral wins — temporal may be commemorated
    if (tParsed.numericRank >= 1.5 && tParsed.numericRank < 7 && tfile) {
      commemorations.push(tParsed.name || tfile);
    }
    // Add any sanctoral commemoration candidates
    for (const c of commemoCandidates) {
      const cRank = getRankFromFile(officeDir, c, version);
      if (cRank) {
        const parsed = parseRankField(cRank);
        if (parsed.name) {
          commemorations.push(parsed.name);
        }
      }
    }

    return {
      celebration: {
        name: sParsed.name || extractNameFromFile(officeDir, sfile),
        rank: sParsed.numericRank,
        rankName: sParsed.rankType,
        source: 'sanctoral',
      },
      weekRef,
      commemorations,
      transferredFrom,
    };
  } else {
    // Temporal wins — sanctoral may be commemorated
    if (sParsed.numericRank >= 1.5 && sfile) {
      commemorations.push(sParsed.name || sfile);
    }

    return {
      celebration: {
        name: tParsed.name || extractNameFromFile(officeDir, tfile),
        rank: tParsed.numericRank,
        rankName: tParsed.rankType,
        source: 'temporal',
      },
      weekRef,
      commemorations,
      transferredFrom,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the office name from the [Officium] section of a file.
 * Used as fallback when the [Rank] field has no name component.
 */
function extractNameFromFile(officeDir: string, filename: string, depth = 0): string {
  if (!filename || depth > 5) return filename || '';

  const filePath = resolve(officeDir, filename.endsWith('.txt') ? filename : `${filename}.txt`);

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return filename;
  }

  // Handle file-level @redirect (first line starts with @)
  const firstLine = content.split('\n')[0].trim();
  if (firstLine.startsWith('@')) {
    return extractNameFromFile(officeDir, firstLine.slice(1).trim(), depth + 1);
  }

  const lines = content.split('\n');
  let inOfficium = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^\[Officium\]/.test(line)) {
      inOfficium = true;
      continue;
    }

    if (inOfficium) {
      if (line.startsWith('[')) break;
      if (!line || line.startsWith('(')) continue;
      return line;
    }
  }

  return filename;
}
