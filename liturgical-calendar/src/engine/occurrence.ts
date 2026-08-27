/**
 * occurrence.ts — Occurrence/Precedence resolution module
 *
 * Day-level TypeScript port of the occurrence() function from horascommon.pl.
 * Given a date and version, resolves which liturgical office wins between
 * the temporal (season) and sanctoral (saints) cycles, including the
 * commemorations retained by each rubric family. Hour-specific details such
 * as first/second Vespers are intentionally outside the calendar-day model.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Celebration, ParsedRank } from './types';
import { getWeek, getSday, dayOfWeek, monthDay } from './date';
import { parseRankField } from './parser';
import type { Directorium } from './directorium';

// Calendar builds resolve the same finite set of office files millions of
// times. Cache immutable source reads and parsed lookups so generating the
// long-range calendar does not repeatedly hit the filesystem.
const officeFileCache = new Map<string, string | null>();
const rankCache = new Map<string, string>();
const officeNameCache = new Map<string, string>();
const officeRuleCache = new Map<string, string>();

function readOfficeFile(filePath: string): string | null {
  if (officeFileCache.has(filePath)) return officeFileCache.get(filePath)!;

  try {
    const content = readFileSync(filePath, 'utf-8');
    officeFileCache.set(filePath, content);
    return content;
  } catch {
    officeFileCache.set(filePath, null);
    return null;
  }
}

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

function rubricaPredicateMatches(predicate: string, version: string): boolean {
  const normalized = predicate.trim().replace(/\s+/g, ' ');
  if (!normalized) return false;

  // SetupString.pl defines these named predicates instead of treating them
  // as literal substrings of the version label.
  if (/^trident(?:ina)?$/i.test(normalized)) return /trident/i.test(version);
  if (/^monastic[ao]?$/i.test(normalized)) return /monastic/i.test(version);
  if (/^innovatis?$/i.test(normalized)) return /2020 USA|NewCal|innovata/i.test(version);

  try {
    // The original vero() evaluator treats every other rubrica predicate as
    // a regular expression tested against the complete version string. This
    // makes `196` match both 1960 and 1963, while `1963` does not match 1960.
    return new RegExp(normalized, 'i').test(version);
  } catch {
    return false;
  }
}

function rubricaClauseMatches(clause: string, version: string): boolean {
  const match = clause.trim().match(/^rubric(?:a|is)\s+(.+?)$/i);
  if (!match) return false;

  const predicate = match[1]
    .replace(/\s+(?:dicitur|dicuntur|omittitur|omittuntur).*$/i, '')
    .trim();
  return rubricaPredicateMatches(predicate, version);
}

/**
 * Check if a condition like `(sed rubrica 196 aut rubrica tridentina)` or
 * `(rubrica 196)` matches the given version.
 *
 * Supports `aut` (OR) and `nisi` (NOT) connectives.
 */
function conditionMatchesVersion(condition: string, version: string): boolean {
  const lower = condition.toLowerCase();

  // Split on 'aut' to get OR-alternatives
  const alternatives = lower.split(/\s+aut\s+/);

  for (const alt of alternatives) {
    const parts = alt.split(/\s+(et|nisi)\s+/);
    let negate = false;
    let matches = true;

    for (const part of parts) {
      if (part === 'et') continue;
      if (part === 'nisi') {
        negate = true;
        continue;
      }

      const clauseMatches = rubricaClauseMatches(part, version);
      if (negate ? clauseMatches : !clauseMatches) {
        matches = false;
        break;
      }
    }

    if (matches) return true;
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
export function getRankFromFile(officeDir: string, filename: string, version: string, depth = 0, fallbackOfficeDir?: string): string {
  const cacheKey = [officeDir, filename, version, depth, fallbackOfficeDir ?? ''].join('\0');
  const cached = rankCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const rank = getRankFromFileUncached(officeDir, filename, version, depth, fallbackOfficeDir);
  rankCache.set(cacheKey, rank);
  return rank;
}

function getRankFromFileUncached(officeDir: string, filename: string, version: string, depth = 0, fallbackOfficeDir?: string): string {
  if (depth > 5) return ''; // Prevent infinite redirect loops

  const filePath = resolve(officeDir, filename.endsWith('.txt') ? filename : `${filename}.txt`);

  const content = readOfficeFile(filePath);
  if (content === null) {
    // File not found in primary dir — use fallback metadata. For a plain
    // redirect, still prefer the translated target in the primary locale.
    if (fallbackOfficeDir && fallbackOfficeDir !== officeDir) {
      const fbPath = resolve(fallbackOfficeDir, filename.endsWith('.txt') ? filename : `${filename}.txt`);
      const fbContent = readOfficeFile(fbPath);
      if (fbContent !== null) {
        const fbFirst = fbContent.split('\n')[0].trim();
        if (fbFirst.startsWith('@') && !/^\[Rank\]/m.test(fbContent)) {
          return getRankFromFile(officeDir, fbFirst.slice(1).trim(), version, depth + 1, fallbackOfficeDir);
        }
      }
      return getRankFromFile(fallbackOfficeDir, filename, version, depth, undefined);
    }
    return '';
  }

  // A file may begin with an @redirect and then override selected sections.
  // Parse a local [Rank] first; follow the redirect only when none is supplied.
  const firstLine = content.split('\n')[0].trim();
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

  const result = selectedRank || baseRank;
  if (!result && firstLine.startsWith('@')) {
    const redirectTarget = firstLine.slice(1).trim();
    return getRankFromFile(officeDir, redirectTarget, version, depth + 1, fallbackOfficeDir);
  }

  // If no [Rank] found in locale file, try fallback (e.g. Latin has rank metadata)
  if (!result && fallbackOfficeDir && fallbackOfficeDir !== officeDir) {
    return getRankFromFile(fallbackOfficeDir, filename, version, depth, undefined);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Read [Rule] from office file
// ---------------------------------------------------------------------------

/**
 * Read the effective [Rule] section used for occurrence decisions.
 *
 * The upstream Perl engine consults this metadata for rules such as
 * `Festum Domini`, `No commemoratio`, and `Omit ... Commemoratio`. Locale
 * files are sometimes partial, so the Latin fallback is used when the
 * selected locale does not provide the section.
 */
export function getRuleFromFile(
  officeDir: string,
  filename: string,
  version: string,
  depth = 0,
  fallbackOfficeDir?: string,
): string {
  const cacheKey = [officeDir, filename, version, depth, fallbackOfficeDir ?? ''].join('\0');
  const cached = officeRuleCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const rule = getRuleFromFileUncached(
    officeDir,
    filename,
    version,
    depth,
    fallbackOfficeDir,
  );
  officeRuleCache.set(cacheKey, rule);
  return rule;
}

function getRuleFromFileUncached(
  officeDir: string,
  filename: string,
  version: string,
  depth = 0,
  fallbackOfficeDir?: string,
): string {
  if (depth > 5) return '';

  const filePath = resolve(officeDir, filename.endsWith('.txt') ? filename : `${filename}.txt`);
  const content = readOfficeFile(filePath);

  if (content === null) {
    if (fallbackOfficeDir && fallbackOfficeDir !== officeDir) {
      return getRuleFromFile(fallbackOfficeDir, filename, version, depth, undefined);
    }
    return '';
  }

  const lines = content.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  const ruleLines: string[] = [];
  let inRuleSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^\[Rule\]$/i.test(line)) {
      inRuleSection = true;
      continue;
    }
    if (inRuleSection && /^\[.+\]$/.test(line)) break;
    if (!inRuleSection || !line) continue;

    // setupstring accepts conditional rule lines of the form
    // `(rubrica divino aut rubrica 1955) Festum Domini`.
    const conditional = line.match(/^\((.+?)\)\s*(.*)$/);
    if (conditional) {
      if (conditionMatchesVersion(conditional[1], version) && conditional[2]) {
        ruleLines.push(conditional[2]);
      }
      continue;
    }

    ruleLines.push(line);
  }

  if (ruleLines.length > 0) return ruleLines.join('\n');

  // A redirecting office inherits metadata unless it overrides [Rule].
  if (firstLine.startsWith('@')) {
    return getRuleFromFile(
      officeDir,
      firstLine.slice(1).trim(),
      version,
      depth + 1,
      fallbackOfficeDir,
    );
  }

  if (fallbackOfficeDir && fallbackOfficeDir !== officeDir) {
    return getRuleFromFile(fallbackOfficeDir, filename, version, depth, undefined);
  }
  return '';
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
  fallbackOfficeDir?: string,
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
  const fixedTemporaEntry = dir.getFromDirektorium('tempora', version, sday);
  if (fixedTemporaEntry && /tempora/i.test(fixedTemporaEntry) && !dir.isTransferred(fixedTemporaEntry, year, version)) {
    tfile = fixedTemporaEntry;
  }

  // The original engine overlays August–November monthly temporal files on
  // post-Pentecost offices. Most monthly files only provide Scripture, but
  // September Ember Days have their own Rank and therefore become the office.
  const monthlyRef = monthDay(day, month, year, /196/.test(version));
  if (monthlyRef) {
    const monthlyFile = `Tempora/${monthlyRef}`;
    if (getRankFromFile(officeDir, monthlyFile, version, 0, fallbackOfficeDir)) {
      tfile = monthlyFile;
    }
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
    tRankStr = getRankFromFile(officeDir, tfile, version, 0, fallbackOfficeDir);
    if (tRankStr) {
      tParsed = parseRankField(tRankStr);
      // If the [Rank] name field is empty, populate from [Officium]
      if (!tParsed.name) {
        tParsed = { ...tParsed, name: extractNameFromFile(officeDir, tfile, 0, fallbackOfficeDir) };
      }
    }
  }

  // -----------------------------------------------------------------------
  // 3. Build sanctoral reference
  // -----------------------------------------------------------------------
  // Local calendars store fixed sanctoral propers in the Tempora overlay.
  // Prefer that local entry; otherwise fall back to the general kalendar.
  const kalEntry = fixedTemporaEntry && !/tempora/i.test(fixedTemporaEntry)
    ? fixedTemporaEntry
    : dir.getFromDirektorium('kalendar', version, sday);
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
  let sRule = '';

  if (sfile) {
    sRankStr = getRankFromFile(officeDir, sfile, version, 0, fallbackOfficeDir);
    sRule = getRuleFromFile(officeDir, sfile, version, 0, fallbackOfficeDir);
    if (sRankStr) {
      sParsed = parseRankField(sRankStr);
      if (!sParsed.name) {
        sParsed = { ...sParsed, name: extractNameFromFile(officeDir, sfile, 0, fallbackOfficeDir) };
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
  let sanctoralSuppressed = false;

  // High temporal rank suppresses low sanctoral
  if (
    (tParsed.numericRank >= ((vIs1960 || vIs1955) ? 6 : 7) && sParsed.numericRank < 6) ||
    (tParsed.numericRank >= 6 && sParsed.numericRank < 2.1 && !isSunday && !/feria|sabbato|in octava/i.test(tParsed.name))
  ) {
    sanctoralSuppressed = true;
    sRankStr = '';
    sParsed = { name: '', rankType: '', numericRank: 0 };
    sRule = '';
    sfile = '';
  }

  // 1960: on Sundays, I cl suppresses < I cl, II cl suppresses < II cl
  if (vIs1960 && isSunday) {
    if (
      (tParsed.numericRank >= 6 && sParsed.numericRank < 6) ||
      (tParsed.numericRank >= 5 && sParsed.numericRank < 5)
    ) {
      sanctoralSuppressed = true;
      sRankStr = '';
      sParsed = { name: '', rankType: '', numericRank: 0 };
      sRule = '';
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
      if (
        tParsed.numericRank <= 5 &&
        (sParsed.numericRank >= 6 || (sParsed.numericRank >= 5 && /Festum Domini/i.test(sRule)))
      ) {
        sanctoralWins = true;
      } else if (/Conceptione Immaculata/i.test(sParsed.name)) {
        // Rubricae generales 15: the Immaculate Conception is preferred to
        // the Second Sunday of Advent in occurrence.
        sanctoralWins = true;
      }
    } else {
      // Pre-1960: feasts of the Lord with sufficient rank beat minor Sundays
      if (
        /Festum Domini/i.test(sRule) &&
        sParsed.numericRank >= 2 &&
        tParsed.numericRank <= 5
      ) {
        sanctoralWins = true;
      }
    }
  }

  // -----------------------------------------------------------------------
  // 8. Build result
  // -----------------------------------------------------------------------
  const commemorations: string[] = [];
  const pushCommemoration = (name: string): void => {
    if (name && !commemorations.includes(name)) commemorations.push(name);
  };

  const tRule = tfile
    ? getRuleFromFile(officeDir, tfile, version, 0, fallbackOfficeDir)
    : '';
  const temporalForbidsCommemorations =
    /omit.*commemoratio|no commemoration?/i.test(tRule);

  // Day-level equivalent of upstream climit1960(). A return value of 2 in
  // horascommon.pl means the saint is commemorated at Lauds (and at Mass),
  // which still belongs in a whole-day calendar record.
  const sanctoralMayBeCommemorated = (rank: number): boolean => {
    if (!rank || sanctoralSuppressed || temporalForbidsCommemorations) return false;
    if (!vIs1960) return true;
    if (isSunday) return rank >= 5;
    if (rank >= 6) return true;
    return rank > 1;
  };

  if (sanctoralWins) {
    // Sanctoral wins — temporal may be commemorated
    const temporalCommemorationLimit = sParsed.numericRank >= 5 ? 2.1 : 1.5;
    if (
      tParsed.numericRank >= temporalCommemorationLimit &&
      tParsed.numericRank < 7 &&
      tfile
    ) {
      pushCommemoration(tParsed.name || tfile);
    }
    // Add any sanctoral commemoration candidates
    for (const c of commemoCandidates) {
      const cRank = getRankFromFile(officeDir, c, version, 0, fallbackOfficeDir);
      if (cRank) {
        const parsed = parseRankField(cRank);
        if (parsed.name) {
          pushCommemoration(parsed.name);
        }
      }
    }

    return {
      celebration: {
        name: sParsed.name || extractNameFromFile(officeDir, sfile, 0, fallbackOfficeDir),
        rank: sParsed.numericRank,
        rankName: sParsed.rankType,
        source: 'sanctoral',
      },
      weekRef,
      commemorations,
      transferredFrom,
    };
  } else {
    // Temporal wins — preserve every commemoration allowed by the upstream
    // rubric logic, including former Simplex offices (rank 1.1) in 1955/1960.
    if (sfile && sanctoralMayBeCommemorated(sParsed.numericRank)) {
      pushCommemoration(sParsed.name || sfile);
    }

    if (!sanctoralSuppressed && !temporalForbidsCommemorations) {
      for (const candidate of commemoCandidates) {
        const rank = getRankFromFile(
          officeDir,
          candidate,
          version,
          0,
          fallbackOfficeDir,
        );
        if (!rank) continue;
        const parsed = parseRankField(rank);
        if (sanctoralMayBeCommemorated(parsed.numericRank)) {
          pushCommemoration(
            parsed.name || extractNameFromFile(
              officeDir,
              candidate,
              0,
              fallbackOfficeDir,
            ),
          );
        }
      }
    }

    return {
      celebration: {
        name: tParsed.name || extractNameFromFile(officeDir, tfile, 0, fallbackOfficeDir),
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
function extractNameFromFile(officeDir: string, filename: string, depth = 0, fallbackOfficeDir?: string): string {
  const cacheKey = [officeDir, filename, depth, fallbackOfficeDir ?? ''].join('\0');
  const cached = officeNameCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const name = extractNameFromFileUncached(officeDir, filename, depth, fallbackOfficeDir);
  officeNameCache.set(cacheKey, name);
  return name;
}

function extractNameFromFileUncached(officeDir: string, filename: string, depth = 0, fallbackOfficeDir?: string): string {
  if (!filename || depth > 5) return filename || '';

  const filePath = resolve(officeDir, filename.endsWith('.txt') ? filename : `${filename}.txt`);

  const content = readOfficeFile(filePath);
  if (content === null) {
    // File not found — use the fallback locale. A plain redirect may point to
    // an office which is translated in the primary locale, so prefer it.
    if (fallbackOfficeDir && fallbackOfficeDir !== officeDir) {
      const fbPath = resolve(fallbackOfficeDir, filename.endsWith('.txt') ? filename : `${filename}.txt`);
      const fbContent = readOfficeFile(fbPath);
      if (fbContent !== null) {
        const fbFirst = fbContent.split('\n')[0].trim();
        if (fbFirst.startsWith('@') && !/^\[Officium\]/m.test(fbContent)) {
          return extractNameFromFile(officeDir, fbFirst.slice(1).trim(), depth + 1, fallbackOfficeDir);
        }
      }
      return extractNameFromFile(fallbackOfficeDir, filename, depth, undefined);
    }
    return filename;
  }

  // A redirecting file can override [Officium], so inspect it before following
  // the referenced office.
  const firstLine = content.split('\n')[0].trim();
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

  if (firstLine.startsWith('@')) {
    return extractNameFromFile(officeDir, firstLine.slice(1).trim(), depth + 1, fallbackOfficeDir);
  }

  // Locale files are often intentionally partial (for example, containing
  // only a translated prayer). If [Officium] is absent, obtain the title from
  // the fallback locale instead of exposing an internal file reference.
  if (fallbackOfficeDir && fallbackOfficeDir !== officeDir) {
    return extractNameFromFile(fallbackOfficeDir, filename, depth, undefined);
  }

  return filename;
}
