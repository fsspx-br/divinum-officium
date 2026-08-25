import { describe, expect, it, vi } from 'vitest';
import { handleEventRequest } from '../events-api/server.js';

const input = {
  title: 'Missa',
  date: '2026-09-23',
  startTime: '18:30',
  endTime: '19:30',
  timeZone: 'America/Sao_Paulo',
  location: '',
  description: '',
};

function makeStore() {
  return {
    list: vi.fn(async () => []),
    create: vi.fn(async (event) => ({ ...event, revision: '"one"' })),
    get: vi.fn(async (uid) => ({ uid, ...input, sequence: 0, createdAt: '2026-08-24T12:00:00.000Z', updatedAt: '2026-08-24T12:00:00.000Z', revision: '"one"' })),
    update: vi.fn(async (event) => ({ ...event, revision: '"two"' })),
    delete: vi.fn(async () => ({ ok: true })),
  };
}

describe('events API router', () => {
  it('lists public events for a date range', async () => {
    const store = makeStore();
    const result = await handleEventRequest({ method: 'GET', url: '/api/events?from=2026-01-01&to=2027-01-01' }, store);
    expect(result.status).toBe(200);
    expect(store.list).toHaveBeenCalledWith('2026-01-01', '2027-01-01');
  });

  it('creates a valid event', async () => {
    const store = makeStore();
    const result = await handleEventRequest({ method: 'POST', url: '/api/admin/events', bodyText: JSON.stringify(input) }, store);
    expect(result.status).toBe(201);
    expect(store.create).toHaveBeenCalledOnce();
  });

  it('rejects an invalid event before storage', async () => {
    const store = makeStore();
    const result = await handleEventRequest({ method: 'POST', url: '/api/admin/events', bodyText: JSON.stringify({ ...input, endTime: '17:00' }) }, store);
    expect(result.status).toBe(400);
    expect(store.create).not.toHaveBeenCalled();
  });

  it('requires a revision to update and delete', async () => {
    const store = makeStore();
    const put = await handleEventRequest({ method: 'PUT', url: '/api/admin/events/test', bodyText: JSON.stringify(input), headers: {} }, store);
    const del = await handleEventRequest({ method: 'DELETE', url: '/api/admin/events/test', headers: {} }, store);
    expect(put.status).toBe(428);
    expect(del.status).toBe(428);
  });

  it('reports an optimistic concurrency conflict', async () => {
    const store = makeStore();
    store.update.mockResolvedValueOnce({ conflict: true });
    const result = await handleEventRequest({
      method: 'PUT',
      url: '/api/admin/events/test',
      bodyText: JSON.stringify(input),
      headers: { 'if-match': '"stale"' },
    }, store);
    expect(result.status).toBe(409);
  });

  it('returns the public subscription as a streamed calendar response', async () => {
    const store = makeStore();
    const result = await handleEventRequest(
      { method: 'GET', url: '/calendars/rubrics-1960-pt.ics', headers: {} },
      store,
      { distDir: '/tmp/litcal-events-server-missing' },
    );
    expect(result.status).toBe(200);
    expect(result.headers['Content-Type']).toBe('text/calendar; charset=utf-8');
    expect(result.stream).toBeDefined();

    let body = '';
    for await (const chunk of result.stream) body += chunk;
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('END:VCALENDAR');
  });
});
