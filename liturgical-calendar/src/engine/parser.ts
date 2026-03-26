import type { VersionDef, ParsedRank } from './types';

// ---------------------------------------------------------------------------
// RawTransferEntry – local type used by parseTransferFile
// ---------------------------------------------------------------------------
export interface RawTransferEntry {
  key: string;
  value: string;
  versions: string[];
}

// ---------------------------------------------------------------------------
// parseDataFile
// ---------------------------------------------------------------------------
// Parses the version registry in data.txt.
// Header line (first non-comment line) is skipped.
// Format: version,kalendar,transfer,stransfer[,base[,transferbase]]
// Lines starting with # are comments.
// ---------------------------------------------------------------------------
export function parseDataFile(content: string): Record<string, VersionDef> {
  const result: Record<string, VersionDef> = {};
  let headerSkipped = false;

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (!headerSkipped) {
      headerSkipped = true;
      continue; // skip the header row
    }

    const parts = line.split(',');
    if (parts.length < 4) continue;

    const version = parts[0].trim();
    if (!version) continue;

    const entry: VersionDef = {
      version,
      kalendar:  parts[1].trim(),
      transfer:  parts[2].trim(),
      stransfer: parts[3].trim(),
    };

    if (parts.length > 4 && parts[4].trim()) {
      entry.base = parts[4].trim();
    }
    if (parts.length > 5 && parts[5].trim()) {
      entry.tbase = parts[5].trim();
    }

    result[version] = entry;
  }

  return result;
}

// ---------------------------------------------------------------------------
// parseKalendarFile
// ---------------------------------------------------------------------------
// Parses a Kalendaria/*.txt sanctoral-cycle file.
// Lines starting with # or * are skipped.
// Format: day=fileRef=...  (only the first two =-separated fields matter)
// XXXXX as fileRef means deletion — we store it as-is so callers can filter.
// ~ in the fileRef field separates multiple entries for the same day; we use
// the first segment as the primary file reference.
// ---------------------------------------------------------------------------
export function parseKalendarFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('*')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const day     = line.slice(0, eqIdx).trim();
    const rest    = line.slice(eqIdx + 1);
    // fileRef is the text before the next '='
    const nextEq  = rest.indexOf('=');
    const fileRef = (nextEq === -1 ? rest : rest.slice(0, nextEq)).trim();

    if (!day || !fileRef) continue;

    // Multiple sub-entries for the same day are separated by ~.
    // The primary ref is the first ~ segment.
    const primaryRef = fileRef.split('~')[0].trim();

    result[day] = primaryRef;
  }

  return result;
}

// ---------------------------------------------------------------------------
// parseTemporaFile
// ---------------------------------------------------------------------------
// Parses a Tempora/*.txt temporal-cycle redirect file.
// Format: key=value;;  (everything after the first ;; is ignored)
// Lines starting with # are comments.
// ---------------------------------------------------------------------------
export function parseTemporaFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key      = line.slice(0, eqIdx).trim();
    const afterKey = line.slice(eqIdx + 1);

    // Value stops at the first ;;
    const sepIdx   = afterKey.indexOf(';;');
    const value    = (sepIdx === -1 ? afterKey : afterKey.slice(0, sepIdx)).trim();

    if (!key) continue;

    result[key] = value;
  }

  return result;
}

// ---------------------------------------------------------------------------
// parseTransferFile
// ---------------------------------------------------------------------------
// Parses a Transfer/*.txt Easter-dependent transfer file.
// Format: key=value;;version-filter
// Version filter is a space-separated list (may be empty).
// Lines starting with # are comments.
// ---------------------------------------------------------------------------
export function parseTransferFile(content: string): RawTransferEntry[] {
  const result: RawTransferEntry[] = [];

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key      = line.slice(0, eqIdx).trim();
    const afterKey = line.slice(eqIdx + 1);

    // Split on ;; to get value and optional version filter
    const sepIdx      = afterKey.indexOf(';;');
    const value       = (sepIdx === -1 ? afterKey : afterKey.slice(0, sepIdx)).trim();
    const versionPart = sepIdx === -1 ? '' : afterKey.slice(sepIdx + 2).trim();

    const versions = versionPart
      ? versionPart.split(/\s+/).filter(Boolean)
      : [];

    if (!key) continue;

    result.push({ key, value, versions });
  }

  return result;
}

// ---------------------------------------------------------------------------
// parseRankField
// ---------------------------------------------------------------------------
// Parses a rank string from an office file header.
// Format: ;;name;;rankType;;numericRank;;commonRef
// (leading ;; may or may not be present; four ;;-separated parts after it)
// ---------------------------------------------------------------------------
export function parseRankField(rank: string): ParsedRank {
  // Strip any surrounding whitespace
  const trimmed = rank.trim();

  // The raw content may start with ;; — split on ;; throughout
  const parts = trimmed.split(';;').map(p => p.trim());

  // If the string starts with ';;', split produces an empty first element.
  // We want: [name, rankType, numericRank, commonRef?]
  const meaningful = parts.filter((_, i) => !(i === 0 && parts[0] === ''));

  // Format after stripping the leading empty segment:
  //   [name, rankType/numericRank, commonRef?]
  // The numeric rank and string rank type share the same field (e.g. "7").
  const name        = meaningful[0] ?? '';
  const rankType    = meaningful[1] ?? '';
  const numericRank = parseInt(rankType, 10) || 0;
  const commonRef   = meaningful[2] || undefined;

  return { name, rankType, numericRank, commonRef };
}
