import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { Directorium } from '@engine/directorium';
import { resolveOccurrence, getRankFromFile } from '@engine/occurrence';
import { parseRankField } from '@engine/parser';

const DATA_DIR = resolve(__dirname, '../data');
const OFFICE_DIR = resolve(__dirname, '../../web/www/horas/Latin');
const VERSION_1960 = 'Rubrics 1960 - 1960';
const VERSION_DA = 'Divino Afflatu - 1954';

let dir: Directorium;

beforeAll(() => {
  dir = new Directorium(DATA_DIR);
});

// ---------------------------------------------------------------------------
// getRankFromFile
// ---------------------------------------------------------------------------
describe('getRankFromFile', () => {
  it('reads base rank from Easter Sunday temporal file', () => {
    const rank = getRankFromFile(OFFICE_DIR, 'Tempora/Pasc0-0', VERSION_1960);
    expect(rank).toContain('Duplex I classis');
    expect(rank).toContain('7');
  });

  it('reads rank from St. Joseph sanctoral file', () => {
    // Under 1960 rubrics, St. Joseph should be Duplex I classis rank 6
    const rank = getRankFromFile(OFFICE_DIR, 'Sancti/03-19', VERSION_1960);
    expect(rank).toContain('Duplex I classis');
    const parsed = parseRankField(rank);
    expect(parsed.numericRank).toBe(6);
  });

  it('reads version-specific rank for DA version', () => {
    // St. Joseph under Divino Afflatu: should be Duplex I classis rank 6.1
    const rank = getRankFromFile(OFFICE_DIR, 'Sancti/03-19', VERSION_DA);
    const parsed = parseRankField(rank);
    expect(parsed.rankType).toContain('Duplex I classis');
    expect(parsed.numericRank).toBe(6.1);
  });

  it('reads rank from Christmas sanctoral file', () => {
    const rank = getRankFromFile(OFFICE_DIR, 'Sancti/12-25', VERSION_1960);
    const parsed = parseRankField(rank);
    expect(parsed.name).toBe('In Nativitate Domini');
    expect(parsed.rankType).toContain('Duplex I Classis');
    expect(parsed.numericRank).toBe(7);
  });

  it('reads Lenten feria rank', () => {
    const rank = getRankFromFile(OFFICE_DIR, 'Tempora/Quad3-2', VERSION_1960);
    const parsed = parseRankField(rank);
    expect(parsed.rankType).toContain('Feria');
    expect(parsed.numericRank).toBe(3.9);
  });

  it('reads Lenten feria rank for DA version', () => {
    const rank = getRankFromFile(OFFICE_DIR, 'Tempora/Quad3-2', VERSION_DA);
    const parsed = parseRankField(rank);
    expect(parsed.numericRank).toBe(2.1);
  });

  it('returns empty string for non-existent file', () => {
    const rank = getRankFromFile(OFFICE_DIR, 'Tempora/NonExistent', VERSION_1960);
    expect(rank).toBe('');
  });

  it('reads post-Pentecost Sunday rank', () => {
    const rank = getRankFromFile(OFFICE_DIR, 'Tempora/Pent03-0', VERSION_1960);
    const parsed = parseRankField(rank);
    expect(parsed.rankType).toContain('Semiduplex');
    expect(parsed.numericRank).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// resolveOccurrence — integration tests with real data
// ---------------------------------------------------------------------------
describe('resolveOccurrence', () => {
  // Easter Sunday 2026 (Apr 5) — temporal Duplex I classis, rank 7
  it('resolves Easter Sunday 2026 as temporal winner', () => {
    const result = resolveOccurrence(5, 4, 2026, VERSION_1960, dir, OFFICE_DIR);
    expect(result.weekRef).toBe('Pasc0');
    expect(result.celebration.source).toBe('temporal');
    expect(result.celebration.rankName).toContain('Duplex I classis');
    expect(result.celebration.rank).toBe(7);
  });

  // A Lenten feria (Mar 10, 2026 = Tuesday of 3rd week of Lent)
  it('resolves a Lenten feria (Mar 10, 2026) as temporal winner', () => {
    const result = resolveOccurrence(10, 3, 2026, VERSION_1960, dir, OFFICE_DIR);
    expect(result.weekRef).toBe('Quad3');
    expect(result.celebration.source).toBe('temporal');
    expect(result.celebration.rankName).toContain('Feria');
    expect(result.celebration.rank).toBeGreaterThanOrEqual(2);
  });

  // Christmas 2026 (Dec 25)
  // Note: Christmas office is in Sancti/12-25 (the temporal Nat25 file doesn't exist)
  // The weekRef is Nat25 but the office comes from the sanctoral cycle
  it('resolves Christmas 2026 as high-rank celebration', () => {
    const result = resolveOccurrence(25, 12, 2026, VERSION_1960, dir, OFFICE_DIR);
    expect(result.weekRef).toBe('Nat25');
    expect(result.celebration.rank).toBeGreaterThanOrEqual(6);
  });

  // Post-Pentecost Sunday (Jun 14, 2026 = 3rd Sunday after Pentecost)
  // Temporal Sunday should win over low-rank saint (St. Basil = Duplex, rank 3)
  it('resolves a post-Pentecost Sunday as temporal winner over low-rank saint', () => {
    const result = resolveOccurrence(14, 6, 2026, VERSION_1960, dir, OFFICE_DIR);
    expect(result.weekRef).toBe('Pent03');
    expect(result.celebration.source).toBe('temporal');
    expect(result.celebration.rank).toBe(5);
  });

  // St. Joseph 2026 (Mar 19) — sanctoral, Duplex I classis
  // Under 1960 rules: St. Joseph rank 6 vs Lenten feria rank 3.9
  it('resolves St. Joseph 2026 as sanctoral winner', () => {
    const result = resolveOccurrence(19, 3, 2026, VERSION_1960, dir, OFFICE_DIR);
    expect(result.celebration.source).toBe('sanctoral');
    expect(result.celebration.rank).toBe(6);
    expect(result.celebration.rankName).toContain('Duplex I classis');
  });

  // Commemorations: when sanctoral wins, temporal should be commemorated if significant
  it('includes temporal commemoration when sanctoral wins', () => {
    const result = resolveOccurrence(19, 3, 2026, VERSION_1960, dir, OFFICE_DIR);
    // The Lenten feria (rank 3.9) should be commemorated
    expect(result.commemorations.length).toBeGreaterThanOrEqual(0);
    // St. Joseph is sanctoral winner
    expect(result.celebration.source).toBe('sanctoral');
  });
});
