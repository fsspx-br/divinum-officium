/**
 * ics-generator.test.ts — Tests for the ICS file generator
 *
 * Uses inline fixture data — no real calendar data is loaded.
 */

import { describe, it, expect } from 'vitest';
import { formatICSDate, generateICS } from '../src/ics/generator';
import type { CalendarDay } from '../src/engine/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const annunciation: CalendarDay = {
  date: '2026-03-25',
  season: 'lent',
  weekRef: 'Quadp4-3',
  celebration: {
    name: 'Annunciation of the Blessed Virgin Mary',
    rank: 1,
    rankName: 'Double of the First Class',
    source: 'sanctoral',
  },
  color: 'white',
  commemorations: [],
};

const feriaWithComm: CalendarDay = {
  date: '2026-03-26',
  season: 'lent',
  weekRef: 'Quadp4-4',
  celebration: {
    name: 'Feria V infra Hebdomadam IV Quadragesimae',
    rank: 4,
    rankName: 'Feria',
    source: 'temporal',
  },
  color: 'violet',
  commemorations: ['St. Ludger, Bishop', 'St. Braulio, Bishop'],
};

const dayWithTransfer: CalendarDay = {
  date: '2026-03-27',
  season: 'lent',
  weekRef: 'Quadp4-5',
  celebration: {
    name: 'St. John of Damascus, Doctor',
    rank: 3,
    rankName: 'Double',
    source: 'sanctoral',
  },
  color: 'white',
  commemorations: [],
  transferredFrom: '2026-03-26',
};

const specialCharsDay: CalendarDay = {
  date: '2026-12-25',
  season: 'christmas',
  weekRef: 'Nat',
  celebration: {
    name: 'Nativity of Our Lord, Jesus Christ; God & Saviour',
    rank: 1,
    rankName: 'Double of the First Class',
    source: 'temporal',
  },
  color: 'white',
  commemorations: ['St. Anastasia, Martyr'],
};

// ---------------------------------------------------------------------------
// formatICSDate
// ---------------------------------------------------------------------------

describe('formatICSDate', () => {
  it('converts a standard ISO date to compact ICS format', () => {
    expect(formatICSDate('2026-03-25')).toBe('20260325');
  });

  it('handles year boundary dates', () => {
    expect(formatICSDate('2026-01-01')).toBe('20260101');
    expect(formatICSDate('2026-12-31')).toBe('20261231');
  });

  it('handles leap day', () => {
    expect(formatICSDate('2028-02-29')).toBe('20280229');
  });
});

// ---------------------------------------------------------------------------
// generateICS — structural checks
// ---------------------------------------------------------------------------

describe('generateICS structure', () => {
  const ics = generateICS([annunciation], 'Rubrics 1960 - 1960');

  it('starts with BEGIN:VCALENDAR', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
  });

  it('ends with END:VCALENDAR followed by CRLF', () => {
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('contains VERSION:2.0', () => {
    expect(ics).toContain('VERSION:2.0');
  });

  it('contains PRODID', () => {
    expect(ics).toContain('PRODID:');
  });

  it('contains X-WR-CALNAME with version label', () => {
    expect(ics).toContain('Rubrics 1960 - 1960');
  });

  it('contains CALSCALE:GREGORIAN', () => {
    expect(ics).toContain('CALSCALE:GREGORIAN');
  });

  it('contains METHOD:PUBLISH', () => {
    expect(ics).toContain('METHOD:PUBLISH');
  });

  it('uses only CRLF line endings', () => {
    // All newlines must be preceded by CR
    const linesWithLF = ics.split('\n');
    // Every segment except the last should end with \r
    for (let i = 0; i < linesWithLF.length - 1; i++) {
      expect(linesWithLF[i]!.endsWith('\r')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// generateICS — VEVENT checks
// ---------------------------------------------------------------------------

describe('generateICS VEVENT', () => {
  const ics = generateICS([annunciation], 'Tridentine - 1570');

  it('wraps each day in BEGIN:VEVENT / END:VEVENT', () => {
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
  });

  it('sets DTSTART as a DATE value', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20260325');
  });

  it('sets DTEND to the following day', () => {
    expect(ics).toContain('DTEND;VALUE=DATE:20260326');
  });

  it('sets SUMMARY to the celebration name', () => {
    expect(ics).toContain('SUMMARY:Annunciation of the Blessed Virgin Mary');
  });

  it('sets DESCRIPTION with rank information', () => {
    expect(ics).toContain('Double of the First Class');
  });

  it('sets CATEGORIES with season and color', () => {
    expect(ics).toContain('CATEGORIES:lent,white');
  });

  it('sets TRANSP:TRANSPARENT', () => {
    expect(ics).toContain('TRANSP:TRANSPARENT');
  });

  it('includes a UID', () => {
    expect(ics).toContain('UID:');
    expect(ics).toContain('20260325');
    expect(ics).toContain('@divinum-officium');
  });
});

// ---------------------------------------------------------------------------
// generateICS — commemorations
// ---------------------------------------------------------------------------

describe('generateICS commemorations', () => {
  const ics = generateICS([feriaWithComm], 'Rubrics 1960 - 1960');

  it('includes commemorations in DESCRIPTION', () => {
    expect(ics).toContain('St. Ludger');
    expect(ics).toContain('St. Braulio');
  });
});

// ---------------------------------------------------------------------------
// generateICS — transferredFrom
// ---------------------------------------------------------------------------

describe('generateICS transferredFrom', () => {
  const ics = generateICS([dayWithTransfer], 'Rubrics 1960 - 1960');

  it('includes transferredFrom note in DESCRIPTION', () => {
    expect(ics).toContain('Transferred from');
    expect(ics).toContain('2026-03-26');
  });
});

// ---------------------------------------------------------------------------
// generateICS — special character escaping
// ---------------------------------------------------------------------------

describe('generateICS escaping', () => {
  const ics = generateICS([specialCharsDay], 'Rubrics 1960 - 1960');

  it('escapes semicolons in SUMMARY', () => {
    // Semicolons in the name must be escaped as \;
    expect(ics).toContain('\\;');
  });

  it('escapes commas in SUMMARY', () => {
    // Commas in the name must be escaped as \,
    expect(ics).toContain('\\,');
  });
});

// ---------------------------------------------------------------------------
// generateICS — line folding
// ---------------------------------------------------------------------------

describe('generateICS line folding', () => {
  // Build a day with a very long celebration name to force folding
  const longNameDay: CalendarDay = {
    date: '2026-06-01',
    season: 'pentecost',
    weekRef: 'Pent01-1',
    celebration: {
      name: 'A'.repeat(200),
      rank: 2,
      rankName: 'Double of the Second Class',
      source: 'temporal',
    },
    color: 'green',
    commemorations: [],
  };

  const ics = generateICS([longNameDay], 'Test');

  it('folds lines exceeding 75 octets', () => {
    const lines = ics.split('\r\n');
    for (const line of lines) {
      // Continuation lines start with a single space; the leading space counts
      const byteLen = new TextEncoder().encode(line).length;
      expect(byteLen).toBeLessThanOrEqual(75);
    }
  });

  it('marks continuation lines with a leading space', () => {
    const lines = ics.split('\r\n');
    const hasContinuation = lines.some((l) => l.startsWith(' ') && l.length > 1);
    expect(hasContinuation).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateICS — multiple days
// ---------------------------------------------------------------------------

describe('generateICS multiple days', () => {
  const days = [annunciation, feriaWithComm, dayWithTransfer];
  const ics = generateICS(days, 'Rubrics 1960 - 1960');

  it('produces one VEVENT per day', () => {
    const matches = ics.match(/BEGIN:VEVENT/g);
    expect(matches).toHaveLength(3);
  });

  it('produces unique UIDs for each day', () => {
    const uidLines = ics.split('\r\n').filter((l) => l.startsWith('UID:'));
    const uniqueUIDs = new Set(uidLines);
    expect(uniqueUIDs.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// generateICS — empty input
// ---------------------------------------------------------------------------

describe('generateICS empty input', () => {
  const ics = generateICS([], 'Test Version');

  it('still produces a valid VCALENDAR wrapper', () => {
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('contains no VEVENT', () => {
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});
