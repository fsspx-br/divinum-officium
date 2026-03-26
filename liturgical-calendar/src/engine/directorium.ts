/**
 * directorium.ts — Faithful TypeScript port of DivinumOfficium/Directorium.pm
 *
 * Loads version data, kalendar, tempora, and transfer tables with caching
 * and version inheritance.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { VersionDef } from './types';
import { parseDataFile, parseKalendarFile, parseTemporaFile } from './parser';
import { leapYear, getEaster } from './date';

// ---------------------------------------------------------------------------
// Easter letter computation
// ---------------------------------------------------------------------------

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

/**
 * Compute the Easter letter for a given year.
 * Perl: my $letter = ($easter - 319 + ($easter[1] == 4 ? 1 : 0)) % 7;
 * where $easter = month*100 + day
 */
export function getEasterLetter(year: number): string {
  const easter = getEaster(year);
  const easterCode = easter.month * 100 + easter.day;
  const letterIdx = (easterCode - 319 + (easter.month === 4 ? 1 : 0)) % 7;
  return LETTERS[letterIdx];
}

// ---------------------------------------------------------------------------
// Transfer file loading helpers (filter logic from Directorium.pm lines 57-67)
// ---------------------------------------------------------------------------

// Matches lines starting with Jan or early Feb (01-xx, 02-0x, 02-1x, 02-20-23, 02-29, dirge1)
const REGEXP_JAN_EARLY_FEB = /^(?:Hy|seant)?(?:01|02-[01]|02-2[01239]|dirge1)/;
// Also matches =01-xx or =02-0x..02-23 inside value side
const REGEXP_JAN_EARLY_FEB_EXTENDED =
  /^(?:Hy|seant)?(?:01|02-[01]|02-2[01239]|.*=(?:01|02-[01]|02-2[0123])|dirge1)/;

/**
 * Load a transfer file and apply date-range filtering.
 * filter=0: whole year
 * filter=1: exclude Jan/early-Feb entries (Feb 24 – Dec)
 * filter=2: only Jan/early-Feb entries (Jan + Feb 23)
 */
function loadTransferFileLines(
  dataFolder: string,
  name: string,
  filter: number,
  type: string,
): string[] {
  const filePath = resolve(dataFolder, type, `${name}.txt`);
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (filter === 1) {
    // Feb 24 – Dec: exclude Jan/early-Feb
    return lines.filter((l) => !REGEXP_JAN_EARLY_FEB_EXTENDED.test(l));
  } else if (filter === 2) {
    // Jan + Feb 23: only Jan/early-Feb
    return lines.filter((l) => REGEXP_JAN_EARLY_FEB.test(l));
  }
  // filter === 0: whole year
  return lines;
}

// ---------------------------------------------------------------------------
// Directorium class
// ---------------------------------------------------------------------------

export class Directorium {
  private dataFolder: string;
  private data: Record<string, VersionDef> = {};
  private cache: Record<string, Record<string, string>> = {};
  private loaded = false;

  constructor(dataFolder: string) {
    this.dataFolder = dataFolder;
  }

  // -------------------------------------------------------------------------
  // Load version definitions from data.txt
  // -------------------------------------------------------------------------

  private ensureDataLoaded(): void {
    if (this.loaded) return;
    const content = readFileSync(resolve(this.dataFolder, 'data.txt'), 'utf-8');
    this.data = parseDataFile(content);
    this.loaded = true;
  }

  /** Expose loaded version definitions (read-only). */
  getVersionDefs(): Readonly<Record<string, VersionDef>> {
    this.ensureDataLoaded();
    return this.data;
  }

  // -------------------------------------------------------------------------
  // Cache helpers
  // -------------------------------------------------------------------------

  private isCached(key: string): boolean {
    this.ensureDataLoaded();
    return key in this.cache;
  }

  // -------------------------------------------------------------------------
  // Kalendar loading
  // -------------------------------------------------------------------------

  private loadKalendar(version: string): void {
    this.ensureDataLoaded();
    const vd = this.data[version];
    if (!vd) throw new Error(`Unknown version: ${version}`);

    const cacheKey = `kalendar:${version}`;
    const filePath = resolve(this.dataFolder, 'Kalendaria', `${vd.kalendar}.txt`);
    const content = readFileSync(filePath, 'utf-8');

    // The Perl code iterates lines containing '=' and splits on '='.
    // It stores $_dCACHE{$cache_key}{$day} = $file where $file is everything after first '='.
    // Our parseKalendarFile already does this (returns day -> primaryRef).
    // However, the Perl stores the FULL rest after first '=' as the value.
    // Let's match the Perl exactly: day = text before first '=', file = text after first '='.
    const result: Record<string, string> = {};
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('*')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const day = line.slice(0, eqIdx).trim();
      const file = line.slice(eqIdx + 1).trim();
      if (day && file) {
        result[day] = file;
      }
    }

    this.cache[cacheKey] = result;
  }

  // -------------------------------------------------------------------------
  // Tempora loading
  // -------------------------------------------------------------------------

  private loadTempora(version: string): void {
    this.ensureDataLoaded();
    const vd = this.data[version];
    if (!vd) throw new Error(`Unknown version: ${version}`);

    const cacheKey = `tempora:${version}`;
    this.cache[cacheKey] = {};

    // Perl: load_transfer_file($_data{$version}{transfer}, 0, 'Tempora')
    // Then for each line: split on '=', value = substr($val, 0, index($val, ';'))
    const lines = loadTransferFileLines(this.dataFolder, vd.transfer, 0, 'Tempora');
    for (const line of lines) {
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const rest = line.slice(eqIdx + 1);
      // Value is text before first ';'
      const semiIdx = rest.indexOf(';');
      const val = semiIdx === -1 ? rest.trim() : rest.slice(0, semiIdx).trim();
      if (key) {
        this.cache[cacheKey][key] = val;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Transfer loading
  // -------------------------------------------------------------------------

  /**
   * Load transfer tables based on Easter date.
   * type defaults to 'Transfer', pass 'Stransfer' for scriptura transfers.
   */
  loadTransfer(
    version: string,
    year: number,
    type: string = 'Transfer',
  ): Record<string, string> {
    this.ensureDataLoaded();
    const vd = this.data[version];
    if (!vd) throw new Error(`Unknown version: ${version}`);

    // Perl uses lcfirst for the cache key
    const cacheKey = `${type.charAt(0).toLowerCase()}${type.slice(1)}:${version}:${year}`;

    if (this.isCached(cacheKey)) {
      return { ...this.cache[cacheKey] };
    }

    const isLeap = leapYear(year);
    const easter = getEaster(year);
    const easterCode = easter.month * 100 + easter.day;

    const letterIdx = (easterCode - 319 + (easter.month === 4 ? 1 : 0)) % 7;

    // Load letter file + Easter date file
    let lines = loadTransferFileLines(
      this.dataFolder,
      LETTERS[letterIdx],
      isLeap ? 1 : 0,
      type,
    );
    lines = lines.concat(
      loadTransferFileLines(this.dataFolder, String(easterCode), isLeap ? 1 : 0, type),
    );

    if (isLeap) {
      // Load Jan & Feb from next letter/Easter file
      let nextEasterCode = easterCode + 1;
      if (nextEasterCode === 332) nextEasterCode = 401;

      // Perl: $letters[$letter - 6] — in Perl negative indices wrap around
      // $letter - 6 when $letter is e.g. 0 → -6, which in Perl wraps to index 1
      // In JS we need explicit modulo
      const nextLetterIdx = ((letterIdx - 6) % 7 + 7) % 7;

      lines = lines.concat(
        loadTransferFileLines(this.dataFolder, LETTERS[nextLetterIdx], 2, type),
      );
      lines = lines.concat(
        loadTransferFileLines(this.dataFolder, String(nextEasterCode), 2, type),
      );
    }

    // Filter by version and build the transfer map
    // Perl: the version's transfer key from data.txt (lc($type) column)
    const versionKey = vd[type.toLowerCase() as 'transfer' | 'stransfer'] ?? '';

    const transfer: Record<string, string> = {};
    for (const line of lines) {
      const [linePart, ver] = line.split(/\s*;;\s*/, 2);
      // Entry applies if no version filter, or the version key appears in the filter
      if (!ver || ver.includes(versionKey)) {
        const eqIdx = linePart.indexOf('=');
        if (eqIdx === -1) {
          // No '=' in line part — key with empty value
          transfer[linePart.trim()] = '';
        } else {
          const key = linePart.slice(0, eqIdx).trim();
          const val = linePart.slice(eqIdx + 1).trim();
          if (key) {
            transfer[key] = val;
          }
        }
      }
    }

    this.cache[cacheKey] = transfer;
    return { ...transfer };
  }

  // -------------------------------------------------------------------------
  // Main lookup: getFromDirektorium
  // -------------------------------------------------------------------------

  /**
   * Look up an entry in the direktorium, following version inheritance.
   * subject: 'kalendar' | 'tempora' | 'transfer' | 'stransfer'
   */
  getFromDirektorium(
    subject: string,
    version: string,
    key: string,
    year?: number,
  ): string {
    this.ensureDataLoaded();

    const cacheKey =
      subject + ':' + version + (year !== undefined ? `:${year}` : '');
    const base = subject === 'kalendar' ? 'base' : 'tbase';

    // Ensure the subject is loaded
    if (!this.isCached(cacheKey)) {
      switch (subject) {
        case 'kalendar':
          this.loadKalendar(version);
          break;
        case 'tempora':
          this.loadTempora(version);
          break;
        case 'transfer':
          this.loadTransfer(version, year!, 'Transfer');
          break;
        case 'stransfer':
          this.loadTransfer(version, year!, 'Stransfer');
          break;
        default:
          return '';
      }
    }

    const val = this.cache[cacheKey]?.[key];
    if (val) return val;

    // Follow inheritance chain
    const vd = this.data[version];
    const baseVersion = vd?.[base as 'base' | 'tbase'];
    if (baseVersion) {
      return this.getFromDirektorium(subject, baseVersion, key, year);
    }

    return '';
  }

  // -------------------------------------------------------------------------
  // isTransferred
  // -------------------------------------------------------------------------

  /**
   * Check if a feast has been transferred away.
   * Returns the destination key if transferred, empty string otherwise.
   */
  isTransferred(str: string, year: number, version: string): string {
    this.ensureDataLoaded();

    // Strip Sancti(M|Cist|OP)?/ prefix
    let cleaned = str.replace(/Sancti(M|Cist|OP)?\//, '');
    if (!cleaned) return '';

    const transferCacheKey = `transfer:${version}:${year}`;
    if (!this.isCached(transferCacheKey)) {
      this.loadTransfer(version, year, 'Transfer');
    }

    const transfer = this.cache[transferCacheKey] ?? {};

    // Check transfer entries
    for (const [key, val] of Object.entries(transfer)) {
      if (!val) continue;
      if (/(dirge|Hy)/i.test(key)) continue;
      if (/Tempora/i.test(val) && !/Epi1-0/i.test(val)) continue;

      if (
        !new RegExp(`^${escapeRegex(key)}`).test(val) &&
        (new RegExp(escapeRegex(val), 'i').test(cleaned) ||
          new RegExp(escapeRegex(cleaned), 'i').test(val)) &&
        !/v\s*$/i.test(transfer[key])
      ) {
        return key;
      }
    }

    // Check tempora entries
    const temporaCacheKey = `tempora:${version}`;
    if (!this.isCached(temporaCacheKey)) {
      this.loadTempora(version);
    }
    const tempora = this.cache[temporaCacheKey] ?? {};

    for (const [key, val] of Object.entries(tempora)) {
      if (/dirge/.test(key)) continue;
      if (
        new RegExp(escapeRegex(cleaned), 'i').test(val) &&
        transfer[key] &&
        !/v\s*$/i.test(transfer[key])
      ) {
        return key;
      }
    }

    // Follow inheritance
    const vd = this.data[version];
    if (vd?.tbase) {
      return this.isTransferred(str, year, vd.tbase);
    }

    return '';
  }

  // -------------------------------------------------------------------------
  // Convenience: Easter letter
  // -------------------------------------------------------------------------

  getEasterLetter(year: number): string {
    return getEasterLetter(year);
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
