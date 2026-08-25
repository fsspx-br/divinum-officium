import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { escapeIcsText, eventToIcs } from './event.js';

const CRLF = '\r\n';
const VERSION_SLUG = 'Rubrics-1960-1960';
export const CALENDAR_START_YEAR = 2025;
export const CALENDAR_END_YEAR = 3000;

function compactDate(value) {
  return value.replaceAll('-', '');
}

function nextDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function allDayEvent(day) {
  const description = [
    `Classe: ${day.celebration.rankName}`,
    `Dia de Abstinência: ${day.abstinence ? 'Sim' : 'Não'}`,
    `Dia de Preceito: ${day.holyDayOfObligation ? 'Sim' : 'Não'}`,
  ];
  if (day.commemorations?.length) description.push(`Comemorações: ${day.commemorations.join('; ')}`);
  if (day.transferredFrom) description.push(`Transferido de: ${day.transferredFrom}`);
  return [
    'BEGIN:VEVENT',
    `UID:${compactDate(day.date)}-rubrics-1960-pt@calendar.fsspx.br`,
    `DTSTART;VALUE=DATE:${compactDate(day.date)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDate(day.date))}`,
    `SUMMARY:${escapeIcsText(day.celebration.name)}`,
    `DESCRIPTION:${escapeIcsText(description.join('\n'))}`,
    `CATEGORIES:${escapeIcsText(`${day.season},${day.color}`)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ].join(CRLF);
}

async function calendarFiles(distDir) {
  const dataDir = resolve(distDir, 'data', 'pt', VERSION_SLUG);
  let entries;
  try {
    entries = await readdir(dataDir);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const filesByYear = new Map();
  for (const entry of entries) {
    const match = entry.match(/^(\d{4})\.json(\.gz)?$/);
    if (!match) continue;
    const year = Number(match[1]);
    if (year < CALENDAR_START_YEAR || year > CALENDAR_END_YEAR) continue;

    const compressed = Boolean(match[2]);
    const previous = filesByYear.get(year);
    if (!previous || (previous.compressed && !compressed)) {
      filesByYear.set(year, { name: entry, compressed });
    }
  }

  const years = [...filesByYear.keys()].sort((a, b) => a - b);
  return years.map((year) => ({ ...filesByYear.get(year), dataDir }));
}

async function readCalendarFile(file) {
  const content = await readFile(resolve(file.dataDir, file.name));
  const json = file.compressed ? gunzipSync(content).toString('utf8') : content.toString('utf8');
  return JSON.parse(json);
}

function timedEvent(event) {
  const calendar = eventToIcs(event);
  return calendar.slice(calendar.indexOf('BEGIN:VEVENT'), calendar.indexOf('END:VEVENT') + 'END:VEVENT'.length);
}

function calendarHeader() {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FSSPX Brasil//Calendario Liturgico//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Calendário Litúrgico — Rubricas de 1960',
    'X-WR-TIMEZONE:America/Sao_Paulo',
    'BEGIN:VTIMEZONE',
    'TZID:America/Sao_Paulo',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'TZNAME:-03',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  return header.join(CRLF) + CRLF;
}

/**
 * Stream the large 2025–3000 feed one civil year at a time. This keeps the
 * production API well below the memory cost of materializing 356k day objects.
 */
export async function* generatePublicFeedChunks({ distDir, events }) {
  yield calendarHeader();
  for (const file of await calendarFiles(distDir)) {
    const days = await readCalendarFile(file);
    yield days.map(allDayEvent).join(CRLF) + CRLF;
  }
  if (events.length > 0) yield events.map(timedEvent).join(CRLF) + CRLF;
  yield 'END:VCALENDAR' + CRLF;
}

/** Materialized helper retained for deterministic tests and ETag generation. */
export async function generatePublicFeed(options) {
  const chunks = [];
  for await (const chunk of generatePublicFeedChunks(options)) chunks.push(chunk);
  const body = chunks.join('');
  return {
    body,
    etag: `"${createHash('sha256').update(body).digest('hex')}"`,
  };
}

export { allDayEvent };
