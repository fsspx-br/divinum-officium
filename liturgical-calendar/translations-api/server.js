/**
 * server.js — zero-dependency translations persistence API (ESM).
 *
 * GET  /api/translations  -> full overrides object
 * PUT  /api/translations  -> replace overrides (validated), atomic write
 */

import { createServer } from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseOverrides, validateOverrides, serializeOverrides } from './store.js';

const PORT = process.env.PORT || 8090;
const DATA_FILE = process.env.DATA_FILE || '/data/custom-translations.json';

/** Pure request router — testable without sockets or fs. */
export async function handleTranslationsRequest(method, url, bodyText, store) {
  if (url !== '/api/translations') {
    return { status: 404, body: { error: 'not found' } };
  }
  if (method === 'GET') {
    return { status: 200, body: await store.read() };
  }
  if (method === 'PUT') {
    let obj;
    try {
      obj = JSON.parse(bodyText);
    } catch {
      return { status: 400, body: { error: 'invalid JSON' } };
    }
    if (!validateOverrides(obj)) {
      return { status: 400, body: { error: 'invalid shape' } };
    }
    await store.write(obj);
    return { status: 200, body: { ok: true } };
  }
  return { status: 405, body: { error: 'method not allowed' } };
}

// ── fs-backed store ──────────────────────────────────────────────────────────

const fileStore = {
  read: async () => {
    try {
      return parseOverrides(await readFile(DATA_FILE, 'utf8'));
    } catch {
      return {};
    }
  },
  write: async (obj) => {
    await mkdir(dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await writeFile(tmp, serializeOverrides(obj), 'utf8');
    await rename(tmp, DATA_FILE);
  },
};

// ── HTTP wiring (only when run directly) ─────────────────────────────────────

function startServer() {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString('utf8');
    const { status, body } = await handleTranslationsRequest(
      req.method || 'GET',
      req.url || '',
      bodyText,
      fileStore,
    );
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  server.listen(PORT, () => {
    console.log(`translations-api listening on ${PORT}, data file ${DATA_FILE}`);
  });
}

// Start only when executed as the entrypoint, not when imported by tests.
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}
