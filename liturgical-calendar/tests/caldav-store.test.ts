import { describe, expect, it, vi } from 'vitest';
import { CalDavStore } from '../events-api/caldav.js';

function response(status: number): Response {
  return new Response('', { status });
}

describe('CalDavStore collection initialization', () => {
  it('creates a missing calendar collection', async () => {
    const fetchImpl = vi.fn(async () => response(201));
    const store = new CalDavStore({ baseUrl: 'http://radicale', username: 'u', password: 'p', fetchImpl });
    await expect(store.ensureCollection()).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('verifies an existing collection after Radicale returns conflict', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(409))
      .mockResolvedValueOnce(response(207));
    const store = new CalDavStore({ baseUrl: 'http://radicale', username: 'u', password: 'p', fetchImpl });
    await expect(store.ensureCollection()).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[1][1].method).toBe('PROPFIND');
  });

  it('rejects conflict when the collection cannot be verified', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(409))
      .mockResolvedValueOnce(response(404));
    const store = new CalDavStore({ baseUrl: 'http://radicale', username: 'u', password: 'p', fetchImpl });
    await expect(store.ensureCollection()).rejects.toThrow('HTTP 409');
  });
});
