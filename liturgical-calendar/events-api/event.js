import { randomUUID } from 'node:crypto';

const CRLF = '\r\n';
const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function compactDate(value) {
  return value.replaceAll('-', '');
}

function compactTime(value) {
  return `${value.replace(':', '')}00`;
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function escapeIcsText(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function unescapeIcsText(value) {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

export function unfoldIcs(value) {
  return value.replace(/\r?\n[ \t]/g, '');
}

function foldLine(line) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const chunks = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const limit = first ? 75 : 74;
    let end = Math.min(offset + limit, bytes.length);
    while (end < bytes.length && end > offset && (bytes[end] & 0xc0) === 0x80) end--;
    chunks.push(new TextDecoder().decode(bytes.slice(offset, end)));
    offset = end;
    first = false;
  }
  return chunks.join(`${CRLF} `);
}

function property(ics, name) {
  const unfolded = unfoldIcs(ics);
  const match = unfolded.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'mi'));
  return match?.[1] ?? '';
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateEventInput(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['body must be an object'] };
  }

  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const date = typeof value.date === 'string' ? value.date : '';
  const startTime = typeof value.startTime === 'string' ? value.startTime : '';
  const endTime = typeof value.endTime === 'string' ? value.endTime : '';
  const timeZone = typeof value.timeZone === 'string' && value.timeZone
    ? value.timeZone
    : DEFAULT_TIME_ZONE;
  const location = typeof value.location === 'string' ? value.location.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';

  if (!title || title.length > 200) errors.push('title is required and must be at most 200 characters');
  if (!isValidDate(date)) errors.push('date must be a valid YYYY-MM-DD date');
  if (!isValidTime(startTime)) errors.push('startTime must be HH:mm');
  if (!isValidTime(endTime)) errors.push('endTime must be HH:mm');
  if (isValidTime(startTime) && isValidTime(endTime) && endTime <= startTime) {
    errors.push('endTime must be later than startTime');
  }
  if (timeZone !== DEFAULT_TIME_ZONE) errors.push(`timeZone must be ${DEFAULT_TIME_ZONE}`);
  if (location.length > 300) errors.push('location must be at most 300 characters');
  if (description.length > 5000) errors.push('description must be at most 5000 characters');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { title, date, startTime, endTime, timeZone, location, description },
  };
}

export function createEvent(input, now = new Date()) {
  return {
    uid: `${randomUUID()}@calendar.fsspx.br`,
    ...input,
    sequence: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function updateEvent(existing, input, now = new Date()) {
  return {
    ...existing,
    ...input,
    sequence: existing.sequence + 1,
    updatedAt: now.toISOString(),
  };
}

export function eventToIcs(event) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FSSPX Brasil//Liturgical Calendar Events//PT-BR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${timestamp(new Date(event.updatedAt))}`,
    `CREATED:${timestamp(new Date(event.createdAt))}`,
    `LAST-MODIFIED:${timestamp(new Date(event.updatedAt))}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTART;TZID=${event.timeZone}:${compactDate(event.date)}T${compactTime(event.startTime)}`,
    `DTEND;TZID=${event.timeZone}:${compactDate(event.date)}T${compactTime(event.endTime)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join(CRLF)}${CRLF}`;
}

export function eventFromIcs(ics, revision = '') {
  const start = property(ics, 'DTSTART');
  const end = property(ics, 'DTEND');
  const created = property(ics, 'CREATED');
  const updated = property(ics, 'LAST-MODIFIED') || property(ics, 'DTSTAMP');

  function isoTimestamp(value) {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    return match
      ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.000Z`
      : new Date(0).toISOString();
  }

  const startMatch = start.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})\d{2}$/);
  const endMatch = end.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})\d{2}$/);
  if (!startMatch || !endMatch) throw new Error('Unsupported event date format');

  return {
    uid: property(ics, 'UID'),
    title: unescapeIcsText(property(ics, 'SUMMARY')),
    date: `${startMatch[1]}-${startMatch[2]}-${startMatch[3]}`,
    startTime: `${startMatch[4]}:${startMatch[5]}`,
    endTime: `${endMatch[4]}:${endMatch[5]}`,
    timeZone: ics.match(/^DTSTART;TZID=([^:]+):/mi)?.[1] ?? DEFAULT_TIME_ZONE,
    location: unescapeIcsText(property(ics, 'LOCATION')),
    description: unescapeIcsText(property(ics, 'DESCRIPTION')),
    sequence: Number(property(ics, 'SEQUENCE') || 0),
    createdAt: isoTimestamp(created),
    updatedAt: isoTimestamp(updated),
    revision,
  };
}

export function eventResourceName(uid) {
  return `${uid.replace(/[^a-zA-Z0-9@._-]/g, '')}.ics`;
}

export { DEFAULT_TIME_ZONE };
