import { createServer } from 'node:http';
import { CalDavStore } from './caldav.js';
import { createEvent, updateEvent, validateEventInput } from './event.js';
import { generatePublicFeed } from './feed.js';

const PORT = Number(process.env.PORT || 8091);
const DIST_DIR = process.env.LITURGICAL_DIST || '/calendar-dist';

function json(status, body, headers = {}) {
  return { status, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } };
}

function parseJson(bodyText) {
  try {
    return { ok: true, value: JSON.parse(bodyText) };
  } catch {
    return { ok: false };
  }
}

export async function handleEventRequest({ method, url, bodyText = '', headers = {} }, store, options = {}) {
  const parsedUrl = new URL(url, 'http://events-api');
  const path = parsedUrl.pathname;

  if (path === '/health') return json(200, { ok: true });
  if (path === '/api/admin/capabilities') return json(200, { canManageEvents: true });

  if (path === '/api/events' && method === 'GET') {
    const from = parsedUrl.searchParams.get('from') || undefined;
    const to = parsedUrl.searchParams.get('to') || undefined;
    return json(200, { events: await store.list(from, to) });
  }

  if (path === '/api/admin/events' && method === 'POST') {
    const parsed = parseJson(bodyText);
    if (!parsed.ok) return json(400, { error: 'invalid JSON' });
    const validated = validateEventInput(parsed.value);
    if (!validated.ok) return json(400, { error: 'invalid event', details: validated.errors });
    const saved = await store.create(createEvent(validated.value));
    return json(201, saved);
  }

  const match = path.match(/^\/api\/admin\/events\/([^/]+)$/);
  if (match) {
    const uid = decodeURIComponent(match[1]);
    if (method === 'PUT') {
      const parsed = parseJson(bodyText);
      if (!parsed.ok) return json(400, { error: 'invalid JSON' });
      const validated = validateEventInput(parsed.value);
      if (!validated.ok) return json(400, { error: 'invalid event', details: validated.errors });
      const current = await store.get(uid);
      if (!current) return json(404, { error: 'event not found' });
      const revision = headers['if-match'] || parsed.value.revision;
      if (!revision) return json(428, { error: 'revision is required' });
      const saved = await store.update(updateEvent(current, validated.value), revision);
      if (saved.conflict) return json(409, { error: 'event was changed by another editor' });
      return json(200, saved);
    }
    if (method === 'DELETE') {
      const revision = headers['if-match'];
      if (!revision) return json(428, { error: 'revision is required' });
      const deleted = await store.delete(uid, revision);
      if (deleted.missing) return json(404, { error: 'event not found' });
      if (deleted.conflict) return json(409, { error: 'event was changed by another editor' });
      return { status: 204, body: '', headers: {} };
    }
    return json(405, { error: 'method not allowed' });
  }

  if (path === '/calendars/rubrics-1960-pt.ics' && method === 'GET') {
    const events = await store.list();
    const feed = await generatePublicFeed({ distDir: options.distDir || DIST_DIR, events, now: options.now });
    if (headers['if-none-match'] === feed.etag) return { status: 304, body: '', headers: { ETag: feed.etag } };
    return {
      status: 200,
      body: feed.body,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="calendario-liturgico-1960.ics"',
        'Cache-Control': 'public, max-age=60',
        ETag: feed.etag,
      },
    };
  }

  return json(404, { error: 'not found' });
}

function startServer() {
  const store = new CalDavStore({
    baseUrl: process.env.RADICALE_URL || 'http://radicale:5232',
    username: process.env.RADICALE_USER || 'calendar-api',
    password: process.env.RADICALE_PASSWORD || '',
  });

  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const result = await handleEventRequest({
        method: req.method || 'GET',
        url: req.url || '/',
        bodyText: Buffer.concat(chunks).toString('utf8'),
        headers: req.headers,
      }, store);
      res.writeHead(result.status, result.headers);
      res.end(result.body);
    } catch (error) {
      console.error(error);
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'calendar storage unavailable' }));
    }
  });

  store.ensureCollection()
    .then(() => server.listen(PORT, () => console.log(`events-api listening on ${PORT}`)))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

if (process.argv[1] && process.argv[1].endsWith('server.js')) startServer();
