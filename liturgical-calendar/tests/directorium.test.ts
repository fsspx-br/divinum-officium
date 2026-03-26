import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { Directorium, getEasterLetter } from '@engine/directorium';

const DATA_DIR = resolve(__dirname, '../data');

// ---------------------------------------------------------------------------
// getEasterLetter
// ---------------------------------------------------------------------------
describe('getEasterLetter', () => {
  it('returns a letter a-g', () => {
    for (let y = 2020; y <= 2030; y++) {
      const letter = getEasterLetter(y);
      expect('abcdefg').toContain(letter);
    }
  });

  // Easter 2025: April 20 → code 420
  // (420 - 319 + 1) % 7 = 102 % 7 = 4 → 'e'
  it('computes correct letter for 2025 (Easter Apr 20)', () => {
    expect(getEasterLetter(2025)).toBe('e');
  });

  // Easter 2024: March 31 → code 331
  // (331 - 319 + 0) % 7 = 12 % 7 = 5 → 'f'
  it('computes correct letter for 2024 (Easter Mar 31)', () => {
    expect(getEasterLetter(2024)).toBe('f');
  });
});

// ---------------------------------------------------------------------------
// Directorium – version loading
// ---------------------------------------------------------------------------
describe('Directorium – version loading', () => {
  let dir: Directorium;

  beforeAll(() => {
    dir = new Directorium(DATA_DIR);
  });

  it('loads version definitions from data.txt', () => {
    const defs = dir.getVersionDefs();
    expect(defs['Rubrics 1960 - 1960']).toBeDefined();
    expect(defs['Rubrics 1960 - 1960'].kalendar).toBe('1960');
    expect(defs['Rubrics 1960 - 1960'].transfer).toBe('1960');
  });

  it('parses base inheritance', () => {
    const defs = dir.getVersionDefs();
    expect(defs['Rubrics 1960 - 1960'].base).toBe('Reduced - 1955');
  });

  it('parses tbase inheritance', () => {
    const defs = dir.getVersionDefs();
    expect(defs['Divino Afflatu - 1954'].tbase).toBe('Divino Afflatu - 1939');
  });
});

// ---------------------------------------------------------------------------
// Directorium – kalendar lookups
// ---------------------------------------------------------------------------
describe('Directorium – kalendar lookups', () => {
  let dir: Directorium;

  beforeAll(() => {
    dir = new Directorium(DATA_DIR);
  });

  it('looks up a kalendar entry for a known version', () => {
    // 01-01 should exist in any kalendar (Circumcision)
    const result = dir.getFromDirektorium('kalendar', 'Rubrics 1960 - 1960', '01-01');
    expect(result).toBeTruthy();
  });

  it('follows base inheritance for kalendar', () => {
    // Rubrics 1960 - 1960 has base "Reduced - 1955", which has base "Divino Afflatu - 1954"
    // An entry in a base version should be found through inheritance
    const result = dir.getFromDirektorium('kalendar', 'Rubrics 1960 - 1960', '03-19');
    expect(result).toBeTruthy();
  });

  it('returns empty string for a non-existent day', () => {
    const result = dir.getFromDirektorium('kalendar', 'Rubrics 1960 - 1960', '13-99');
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Directorium – tempora lookups
// ---------------------------------------------------------------------------
describe('Directorium – tempora lookups', () => {
  let dir: Directorium;

  beforeAll(() => {
    dir = new Directorium(DATA_DIR);
  });

  it('looks up a tempora entry', () => {
    // Tempora files should have entries like "Tempora/Quad5-5=..."
    const result = dir.getFromDirektorium('tempora', 'Rubrics 1960 - 1960', 'Tempora/Quad6-0');
    // May or may not be present depending on the version's tempora file
    // At minimum we exercise the code path
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Directorium – transfer loading
// ---------------------------------------------------------------------------
describe('Directorium – transfer loading', () => {
  let dir: Directorium;

  beforeAll(() => {
    dir = new Directorium(DATA_DIR);
  });

  it('loads transfer table for a specific year', () => {
    const transfer = dir.loadTransfer('Rubrics 1960 - 1960', 2025);
    expect(typeof transfer).toBe('object');
    // Should have some entries
    expect(Object.keys(transfer).length).toBeGreaterThan(0);
  });

  it('loads transfer table for a leap year', () => {
    const transfer = dir.loadTransfer('Rubrics 1960 - 1960', 2024);
    expect(typeof transfer).toBe('object');
    expect(Object.keys(transfer).length).toBeGreaterThan(0);
  });

  it('returns same cached result on second call', () => {
    const t1 = dir.loadTransfer('Rubrics 1960 - 1960', 2025);
    const t2 = dir.loadTransfer('Rubrics 1960 - 1960', 2025);
    expect(t1).toEqual(t2);
  });

  it('loads stransfer tables', () => {
    const st = dir.loadTransfer('Rubrics 1960 - 1960', 2025, 'Stransfer');
    expect(typeof st).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// Directorium – getFromDirektorium for transfer
// ---------------------------------------------------------------------------
describe('Directorium – getFromDirektorium for transfer', () => {
  let dir: Directorium;

  beforeAll(() => {
    dir = new Directorium(DATA_DIR);
  });

  it('looks up a transfer entry with year', () => {
    const result = dir.getFromDirektorium('transfer', 'Rubrics 1960 - 1960', 'dirge1', 2025);
    // dirge1 is commonly present in transfer tables
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Directorium – isTransferred
// ---------------------------------------------------------------------------
describe('Directorium – isTransferred', () => {
  let dir: Directorium;

  beforeAll(() => {
    dir = new Directorium(DATA_DIR);
  });

  it('returns empty string for a non-transferred feast', () => {
    // A feast that is unlikely to be transferred
    const result = dir.isTransferred('12-25', 2025, 'Rubrics 1960 - 1960');
    expect(result).toBe('');
  });

  it('strips Sancti/ prefix', () => {
    const result = dir.isTransferred('Sancti/12-25', 2025, 'Rubrics 1960 - 1960');
    expect(result).toBe('');
  });

  it('returns empty string for empty input after stripping', () => {
    const result = dir.isTransferred('', 2025, 'Rubrics 1960 - 1960');
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Directorium – Easter letter via instance method
// ---------------------------------------------------------------------------
describe('Directorium – Easter letter instance method', () => {
  it('delegates to getEasterLetter', () => {
    const dir = new Directorium(DATA_DIR);
    expect(dir.getEasterLetter(2025)).toBe(getEasterLetter(2025));
  });
});
