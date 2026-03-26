import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  parseDataFile,
  parseKalendarFile,
  parseTemporaFile,
  parseTransferFile,
  parseRankField,
} from '@engine/parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DATA_DIR = resolve(__dirname, '../data');

function readData(relPath: string): string {
  return readFileSync(resolve(DATA_DIR, relPath), 'utf-8');
}

// ---------------------------------------------------------------------------
// parseDataFile
// ---------------------------------------------------------------------------
describe('parseDataFile – inline samples', () => {
  const SAMPLE = `version,kalendar,transfer,stransfer,base,transferbase
# a comment line
Tridentine - 1570,1570,1570,1570
Divino Afflatu - 1954,1954,1954,1954,Divino Afflatu - 1939
Divino Afflatu - 1939,1939,DA,DA,Tridentine - 1906,Tridentine - 1906
`;

  it('skips the header row', () => {
    const result = parseDataFile(SAMPLE);
    expect(result).not.toHaveProperty('version');
  });

  it('skips comment lines', () => {
    const result = parseDataFile(SAMPLE);
    expect(Object.keys(result)).not.toContain('# a comment line');
  });

  it('parses a minimal entry (4 fields)', () => {
    const result = parseDataFile(SAMPLE);
    expect(result['Tridentine - 1570']).toEqual({
      version:   'Tridentine - 1570',
      kalendar:  '1570',
      transfer:  '1570',
      stransfer: '1570',
    });
  });

  it('parses a 5-field entry with base', () => {
    const result = parseDataFile(SAMPLE);
    expect(result['Divino Afflatu - 1954']).toMatchObject({
      version:   'Divino Afflatu - 1954',
      kalendar:  '1954',
      transfer:  '1954',
      stransfer: '1954',
      base:      'Divino Afflatu - 1939',
    });
    expect(result['Divino Afflatu - 1954'].tbase).toBeUndefined();
  });

  it('parses a 6-field entry with base and tbase', () => {
    const result = parseDataFile(SAMPLE);
    expect(result['Divino Afflatu - 1939']).toMatchObject({
      version:   'Divino Afflatu - 1939',
      kalendar:  '1939',
      transfer:  'DA',
      stransfer: 'DA',
      base:      'Tridentine - 1906',
      tbase:     'Tridentine - 1906',
    });
  });
});

describe('parseDataFile – real data.txt', () => {
  const versions = parseDataFile(readData('data.txt'));

  it('produces a non-empty registry', () => {
    expect(Object.keys(versions).length).toBeGreaterThan(5);
  });

  it('Tridentine - 1570 entry has correct fields', () => {
    expect(versions['Tridentine - 1570']).toMatchObject({
      version:   'Tridentine - 1570',
      kalendar:  '1570',
      transfer:  '1570',
      stransfer: '1570',
    });
  });

  it('Rubrics 1960 - 1960 has base Reduced - 1955', () => {
    expect(versions['Rubrics 1960 - 1960']).toMatchObject({
      base: 'Reduced - 1955',
    });
  });

  it('Divino Afflatu - 1954 has tbase Divino Afflatu - 1939', () => {
    expect(versions['Divino Afflatu - 1954']).toMatchObject({
      tbase: 'Divino Afflatu - 1939',
    });
  });

  it('every entry has all four required string fields', () => {
    for (const [, v] of Object.entries(versions)) {
      expect(typeof v.version).toBe('string');
      expect(typeof v.kalendar).toBe('string');
      expect(typeof v.transfer).toBe('string');
      expect(typeof v.stransfer).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// parseKalendarFile
// ---------------------------------------------------------------------------
describe('parseKalendarFile – inline samples', () => {
  const SAMPLE = `#This file only notes the changes
*January*
01-18=01-18r=S Priscae Virginis=1=
05-06=XXXXX
07-21=07-21r~07-21=S. Laurentii=3=S. Praxedis=1=
08-09=08-09t~08-09cc=Vigilia S. Laurentii=3=S. Romanae=1=
`;

  it('skips comment lines starting with #', () => {
    const result = parseKalendarFile(SAMPLE);
    expect(Object.keys(result)).not.toContain('#This file only notes the changes');
  });

  it('skips section-header lines starting with *', () => {
    const result = parseKalendarFile(SAMPLE);
    expect(Object.keys(result)).not.toContain('*January*');
  });

  it('parses a simple day→fileRef mapping', () => {
    const result = parseKalendarFile(SAMPLE);
    expect(result['01-18']).toBe('01-18r');
  });

  it('stores XXXXX (deletion marker) as-is', () => {
    const result = parseKalendarFile(SAMPLE);
    expect(result['05-06']).toBe('XXXXX');
  });

  it('uses the first ~ segment as the primary ref for multi-entry days', () => {
    const result = parseKalendarFile(SAMPLE);
    // 07-21r~07-21 → primary is 07-21r
    expect(result['07-21']).toBe('07-21r');
    // 08-09t~08-09cc → primary is 08-09t
    expect(result['08-09']).toBe('08-09t');
  });
});

describe('parseKalendarFile – real Kalendaria/1960.txt', () => {
  const kal = parseKalendarFile(readData('Kalendaria/1960.txt'));

  it('produces a non-empty map', () => {
    expect(Object.keys(kal).length).toBeGreaterThan(5);
  });

  it('01-18 maps to 01-18r', () => {
    expect(kal['01-18']).toBe('01-18r');
  });

  it('05-06 is XXXXX (deleted)', () => {
    expect(kal['05-06']).toBe('XXXXX');
  });

  it('07-21 primary ref is 07-21r', () => {
    expect(kal['07-21']).toBe('07-21r');
  });

  it('all keys look like MM-DD', () => {
    for (const key of Object.keys(kal)) {
      expect(key).toMatch(/^\d{2}-\d{2}$/);
    }
  });
});

describe('parseKalendarFile – real Kalendaria/1570.txt', () => {
  const kal = parseKalendarFile(readData('Kalendaria/1570.txt'));

  it('01-01 maps to 01-01', () => {
    expect(kal['01-01']).toBe('01-01');
  });

  it('11 (1570 has many entries) has more than 30 keys', () => {
    expect(Object.keys(kal).length).toBeGreaterThan(30);
  });
});

// ---------------------------------------------------------------------------
// parseTemporaFile
// ---------------------------------------------------------------------------
describe('parseTemporaFile – inline samples', () => {
  const SAMPLE = `# comment
Tempora/Quad5-5=Tempora/Quad5-5Feria;;
Tempora/Quad6-0=Tempora/Quad6-0r;;
C05-18=Votive/Coronatio;;
`;

  it('skips comment lines', () => {
    const result = parseTemporaFile(SAMPLE);
    expect(Object.keys(result)).not.toContain('# comment');
  });

  it('parses key→value, stripping trailing ;;', () => {
    const result = parseTemporaFile(SAMPLE);
    expect(result['Tempora/Quad5-5']).toBe('Tempora/Quad5-5Feria');
    expect(result['Tempora/Quad6-0']).toBe('Tempora/Quad6-0r');
    expect(result['C05-18']).toBe('Votive/Coronatio');
  });
});

describe('parseTemporaFile – real Tempora/1960.txt', () => {
  const tempora = parseTemporaFile(readData('Tempora/1960.txt'));

  it('produces a non-empty map', () => {
    expect(Object.keys(tempora).length).toBeGreaterThan(0);
  });

  it('Tempora/Quad5-5 maps to Tempora/Quad5-5Feria', () => {
    expect(tempora['Tempora/Quad5-5']).toBe('Tempora/Quad5-5Feria');
  });

  it('Tempora/Pent03-5 maps to Tempora/Pent03-5Feria', () => {
    expect(tempora['Tempora/Pent03-5']).toBe('Tempora/Pent03-5Feria');
  });

  it('values do not contain ;;', () => {
    for (const val of Object.values(tempora)) {
      expect(val).not.toContain(';;');
    }
  });
});

describe('parseTemporaFile – real Tempora/1570.txt', () => {
  const tempora = parseTemporaFile(readData('Tempora/1570.txt'));

  it('Tempora/Adv1-0 maps to Tempora/Adv1-0o', () => {
    expect(tempora['Tempora/Adv1-0']).toBe('Tempora/Adv1-0o');
  });
});

// ---------------------------------------------------------------------------
// parseTransferFile
// ---------------------------------------------------------------------------
describe('parseTransferFile – inline samples', () => {
  const SAMPLE = `#=sunday letter: A
01-02=Tempora/Nat2-0;;DA Newcal 1960
01-09=01-08;;1570 1888 1906
08-06=08-06;;1960 Newcal
12-31=Tempora/Nat1-0;;
`;

  it('skips comment lines', () => {
    const result = parseTransferFile(SAMPLE);
    expect(result.every(e => !e.key.startsWith('#'))).toBe(true);
  });

  it('parses key, value and versions correctly', () => {
    const result = parseTransferFile(SAMPLE);
    const jan2 = result.find(e => e.key === '01-02');
    expect(jan2).toBeDefined();
    expect(jan2!.value).toBe('Tempora/Nat2-0');
    expect(jan2!.versions).toEqual(['DA', 'Newcal', '1960']);
  });

  it('parses an entry with multiple versions', () => {
    const result = parseTransferFile(SAMPLE);
    const jan9 = result.find(e => e.key === '01-09');
    expect(jan9!.versions).toEqual(['1570', '1888', '1906']);
  });

  it('returns an empty versions array when filter is absent', () => {
    const result = parseTransferFile(SAMPLE);
    const dec31 = result.find(e => e.key === '12-31');
    expect(dec31!.versions).toEqual([]);
  });

  it('preserves ~ in value (multi-ref not parsed here)', () => {
    const MULTI = `01-15=01-00~01-15~01-15cc;;1888 1906 C1951\n`;
    const [entry] = parseTransferFile(MULTI);
    expect(entry.value).toBe('01-00~01-15~01-15cc');
  });
});

describe('parseTransferFile – real Transfer/a.txt', () => {
  const entries = parseTransferFile(readData('Transfer/a.txt'));

  it('produces a non-empty list', () => {
    expect(entries.length).toBeGreaterThan(5);
  });

  it('01-02 entry has versions including DA', () => {
    const jan2 = entries.find(e => e.key === '01-02');
    expect(jan2).toBeDefined();
    expect(jan2!.versions).toContain('DA');
    expect(jan2!.versions).toContain('1960');
  });

  it('all entries have non-empty key and value strings', () => {
    for (const e of entries) {
      expect(typeof e.key).toBe('string');
      expect(e.key.length).toBeGreaterThan(0);
      expect(typeof e.value).toBe('string');
    }
  });

  it('versions is always an array', () => {
    for (const e of entries) {
      expect(Array.isArray(e.versions)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// parseRankField
// ---------------------------------------------------------------------------
describe('parseRankField – inline samples', () => {
  it('parses a standard rank string with leading ;;', () => {
    const result = parseRankField(';;Duplex I classis cum Octava;;7;;ex C10');
    expect(result).toEqual({
      name:        'Duplex I classis cum Octava',
      rankType:    '7',
      numericRank: 7,
      commonRef:   'ex C10',
    });
  });

  it('returns undefined commonRef when not present', () => {
    const result = parseRankField(';;Feria;;1;;');
    expect(result.commonRef).toBeUndefined();
  });

  it('parses without a leading ;; (bare format)', () => {
    const result = parseRankField('Simplex;;2;;ref');
    expect(result).toMatchObject({
      name:        'Simplex',
      rankType:    '2',
      numericRank: 2,
      commonRef:   'ref',
    });
  });

  it('numericRank defaults to 0 for non-numeric rank', () => {
    const result = parseRankField(';;Feria;;abc;;');
    expect(result.numericRank).toBe(0);
  });

  it('handles whitespace around parts', () => {
    const result = parseRankField('  ;;  Duplex  ;;  6  ;;  ');
    expect(result.name).toBe('Duplex');
    expect(result.rankType).toBe('6');
    expect(result.numericRank).toBe(6);
    expect(result.commonRef).toBeUndefined();
  });

  it('parses Duplex II classis with commonRef', () => {
    const result = parseRankField(';;Duplex II classis;;6;;C8');
    expect(result).toEqual({
      name:        'Duplex II classis',
      rankType:    '6',
      numericRank: 6,
      commonRef:   'C8',
    });
  });
});
