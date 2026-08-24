import { describe, it, expect, vi, afterEach } from 'vitest';
import { getOverrides, saveOverrides } from '../src/ui/translations-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getOverrides', () => {
  it('returns parsed overrides on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ en: { A: 'a' } }),
    })));
    expect(await getOverrides()).toEqual({ en: { A: 'a' } });
  });

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    expect(await getOverrides()).toBeNull();
  });

  it('returns null when fetch throws (sidecar down)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    expect(await getOverrides()).toBeNull();
  });
});

describe('saveOverrides', () => {
  it('PUTs the overrides as JSON', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await saveOverrides({ en: { A: 'a' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/translations', expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ en: { A: 'a' } }),
    }));
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400 })));
    await expect(saveOverrides({})).rejects.toThrow(/400/);
  });
});
