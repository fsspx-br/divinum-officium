import { describe, expect, it } from 'vitest';
import {
  createEvent,
  eventFromIcs,
  eventToIcs,
  updateEvent,
  validateEventInput,
} from '../events-api/event.js';

const validInput = {
  title: 'Missa cantada',
  date: '2026-09-23',
  startTime: '18:30',
  endTime: '19:45',
  timeZone: 'America/Sao_Paulo',
  location: 'Capela São José',
  description: 'Chegar com antecedência.',
};

describe('custom timed events', () => {
  it('validates and normalizes event input', () => {
    const result = validateEventInput({ ...validInput, title: '  Missa cantada  ' });
    expect(result.ok).toBe(true);
    expect(result.value.title).toBe('Missa cantada');
  });

  it('rejects invalid dates and end times before start times', () => {
    const result = validateEventInput({ ...validInput, date: '2026-02-30', endTime: '18:00' });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('date must be a valid YYYY-MM-DD date');
    expect(result.errors).toContain('endTime must be later than startTime');
  });

  it('round-trips Unicode and escaped text through iCalendar', () => {
    const event = createEvent(validInput, new Date('2026-08-24T12:00:00Z'));
    const parsed = eventFromIcs(eventToIcs(event), '"revision-1"');
    expect(parsed).toMatchObject({ ...validInput, uid: event.uid, revision: '"revision-1"' });
  });

  it('ignores DTSTART properties from a server-injected VTIMEZONE', () => {
    const event = createEvent(validInput, new Date('2026-08-24T12:00:00Z'));
    const ics = eventToIcs(event).replace('BEGIN:VEVENT', [
      'BEGIN:VTIMEZONE',
      'TZID:America/Sao_Paulo',
      'BEGIN:STANDARD',
      'DTSTART:20000227T000000',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
    ].join('\r\n'));
    expect(eventFromIcs(ics).date).toBe('2026-09-23');
  });

  it('keeps the UID and increments sequence when edited', () => {
    const event = createEvent(validInput, new Date('2026-08-24T12:00:00Z'));
    const updated = updateEvent(event, { ...validInput, title: 'Missa solene' }, new Date('2026-08-25T12:00:00Z'));
    expect(updated.uid).toBe(event.uid);
    expect(updated.sequence).toBe(1);
    expect(updated.title).toBe('Missa solene');
  });
});
