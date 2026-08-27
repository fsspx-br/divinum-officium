/**
 * generator.ts — ICS file generator for the liturgical calendar
 *
 * Produces RFC 5545-compliant iCalendar (.ics) content from CalendarDay data.
 */

import type { CalendarDay } from '../engine/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRLF = '\r\n';
const MAX_LINE_OCTETS = 75;

export type ICSLocale = 'pt' | 'la';

interface ICSLabels {
  language: string;
  rank: string;
  commemorations: string;
  transferredFrom: string;
  abstinence: string;
  holyDayOfObligation: string;
  yes: string;
  no: string;
}

const ICS_LABELS: Record<ICSLocale, ICSLabels> = {
  en: {
    language: 'EN',
    rank: 'Rank',
    commemorations: 'Commemorations',
    transferredFrom: 'Transferred from',
    abstinence: 'Day of Abstinence',
    holyDayOfObligation: 'Holy Day of Obligation',
    yes: 'Yes',
    no: 'No',
  },
  pt: {
    language: 'PT-BR',
    rank: 'Classe',
    commemorations: 'Comemorações',
    transferredFrom: 'Transferido de',
    abstinence: 'Dia de Abstinência',
    holyDayOfObligation: 'Dia de Preceito',
    yes: 'Sim',
    no: 'Não',
  },
  la: {
    language: 'LA',
    rank: 'Classis',
    commemorations: 'Commemorationes',
    transferredFrom: 'Translatum ex',
    abstinence: 'Dies Abstinentiae',
    holyDayOfObligation: 'Dies Praecepti',
    yes: 'Ita',
    no: 'Non',
  },
};

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Convert an ISO date string ("2026-03-25") to ICS date format ("20260325").
 */
export function formatICSDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Escape special characters per RFC 5545 §3.3.11 TEXT rules.
 * Backslash must be escaped first to avoid double-escaping.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Fold a single property line so that no UTF-8 encoded line exceeds
 * MAX_LINE_OCTETS octets, per RFC 5545 §3.1.
 *
 * Folding inserts CRLF + SPACE before continuation. We work in UTF-8
 * byte counts to handle multi-byte characters correctly.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);

  if (bytes.length <= MAX_LINE_OCTETS) {
    return line;
  }

  const chunks: string[] = [];
  let offset = 0;
  let isFirst = true;
  const limit = isFirst ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;

  while (offset < bytes.length) {
    const maxChunk = isFirst ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    let end = offset + maxChunk;

    if (end >= bytes.length) {
      // Last chunk
      chunks.push(new TextDecoder().decode(bytes.slice(offset)));
      break;
    }

    // Walk back to avoid splitting a multi-byte UTF-8 sequence.
    // UTF-8 continuation bytes start with 0b10xxxxxx (0x80–0xBF).
    while (end > offset && (bytes[end]! & 0xc0) === 0x80) {
      end--;
    }

    chunks.push(new TextDecoder().decode(bytes.slice(offset, end)));
    offset = end;
    isFirst = false;
  }

  return chunks.join(CRLF + ' ');
}

/**
 * Build a single VEVENT block for a CalendarDay.
 */
function buildVEVENT(day: CalendarDay, versionLabel: string, labels: ICSLabels): string {
  const dtstart = formatICSDate(day.date);

  // DTEND = next calendar day (all-day event)
  const startDate = new Date(day.date + 'T00:00:00Z');
  const endDate = new Date(startDate.getTime() + 86400000);
  const dtend = formatICSDate(endDate.toISOString().slice(0, 10));

  // Deterministic UID: date + version slug (collapse consecutive hyphens)
  const versionSlug = versionLabel
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const uid = `${dtstart}-${versionSlug}@divinum-officium`;

  // SUMMARY
  const summary = escapeText(day.celebration.name);

  // DESCRIPTION is shown as Notes by Apple Calendar. Always include both
  // discipline flags so "no" is explicit rather than inferred from absence.
  const descParts: string[] = [
    `${labels.rank}: ${day.celebration.rankName}`,
    `${labels.abstinence}: ${day.abstinence ? labels.yes : labels.no}`,
    `${labels.holyDayOfObligation}: ${day.holyDayOfObligation ? labels.yes : labels.no}`,
  ];
  if (day.commemorations.length > 0) {
    descParts.push(`${labels.commemorations}: ${day.commemorations.join('; ')}`);
  }
  if (day.transferredFrom) {
    descParts.push(`${labels.transferredFrom}: ${day.transferredFrom}`);
  }
  const description = escapeText(descParts.join('\n'));

  // CATEGORIES
  const categories = `${day.season},${day.color}`;

  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `CATEGORIES:${categories}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];

  return lines.map(foldLine).join(CRLF);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate a complete ICS string from an array of CalendarDay objects.
 *
 * @param days         Array of CalendarDay (typically one full year).
 * @param versionLabel Human-readable version name, used in CALNAME and UIDs.
 */
export function generateICS(
  days: CalendarDay[],
  versionLabel: string,
  locale: ICSLocale = 'en',
): string {
  const labels = ICS_LABELS[locale];
  const prodid = `-//Divinum Officium//Liturgical Calendar//${labels.language}`;
  const calName = escapeText(`Divinum Officium – ${versionLabel}`);

  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodid}`,
    `X-WR-CALNAME:${calName}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
    .map(foldLine)
    .join(CRLF);

  const events = days.map((day) => buildVEVENT(day, versionLabel, labels)).join(CRLF);

  const footer = 'END:VCALENDAR';

  return [header, events, footer].join(CRLF) + CRLF;
}
