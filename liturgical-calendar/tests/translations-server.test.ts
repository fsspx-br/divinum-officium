import { describe, it, expect } from 'vitest';
import { handleTranslationsRequest } from '../translations-api/server.js';

function makeStore(initial = {}) {
  let data = initial;
  return {
    read: async () => data,
    write: async (o: object) => { data = o; },
    current: () => data,
  };
}

describe('handleTranslationsRequest', () => {
  it('GET returns the current store contents', async () => {
    const store = makeStore({ en: { A: 'a' } });
    const res = await handleTranslationsRequest('GET', '/api/translations', '', store);
    expect(res).toEqual({ status: 200, body: { en: { A: 'a' } } });
  });

  it('PUT with a valid body writes and returns ok', async () => {
    const store = makeStore();
    const res = await handleTranslationsRequest('PUT', '/api/translations', '{"en":{"A":"a"}}', store);
    expect(res.status).toBe(200);
    expect(store.current()).toEqual({ en: { A: 'a' } });
  });

  it('PUT with malformed JSON returns 400 and does not write', async () => {
    const store = makeStore({ en: {} });
    const res = await handleTranslationsRequest('PUT', '/api/translations', '{bad', store);
    expect(res.status).toBe(400);
    expect(store.current()).toEqual({ en: {} });
  });

  it('PUT with a wrong-shape body returns 400', async () => {
    const store = makeStore();
    const res = await handleTranslationsRequest('PUT', '/api/translations', '[1,2]', store);
    expect(res.status).toBe(400);
  });

  it('unknown method on the route returns 405', async () => {
    const res = await handleTranslationsRequest('DELETE', '/api/translations', '', makeStore());
    expect(res.status).toBe(405);
  });

  it('unknown path returns 404', async () => {
    const res = await handleTranslationsRequest('GET', '/nope', '', makeStore());
    expect(res.status).toBe(404);
  });
});
