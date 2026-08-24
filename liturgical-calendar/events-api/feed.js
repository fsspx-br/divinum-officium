import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { escapeIcsText, eventToIcs } from './event.js';

const CRLF = '\r\n';
const VERSION_SLUG = 'Rubrics-1960-1960';

function compactDate(value) {
  return value.replaceAll('-', '');
}

function nextDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function allDayEvent(day) {
  const description = [`Classe: ${day.celebration.rankName}`];
  if (day.commemorations?.length) description.push(`Comemorações: ${day.commemorations.join('; ')}`);
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

function timedEvent(event) {
  const calendar = eventToIcs(event);
  return calendar.slice(calendar.indexOf('BEGIN:VEVENT'), calendar.indexOf('END:VEVENT') + 'END:VEVENT'.length);
}

export async function generatePublicFeed({ distDir, events, now = new Date() }) {
  const currentYear = now.getUTCFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const days = [];
  for (const year of years) {
    try {
      const path = resolve(distDir, 'data', 'pt', VERSION_SLUG, `${year}.json`);
      days.push(...JSON.parse(await readFile(path, 'utf8')));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

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
  const body = [
    ...header,
    ...days.map(allDayEvent),
    ...events.map(timedEvent),
    'END:VCALENDAR',
    '',
  ].join(CRLF);
  return {
    body,
    etag: `"${createHash('sha256').update(body).digest('hex')}"`,
  };
}

export { allDayEvent };
