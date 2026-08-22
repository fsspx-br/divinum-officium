# Custom Translations Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dev-only editor to the liturgical-calendar app that lets a maintainer override liturgical day names per locale, superseding the official names (falling back to the original when no override exists), persisted via a Docker sidecar API.

**Architecture:** Overrides are a per-locale `{ originalName: customName }` map applied at render time (generated JSON never mutated). A zero-dependency Node sidecar in a separate `docker-compose.yml` serves `GET/PUT /api/translations`, persisting a host-bind-mounted JSON file; Vite proxies `/api` to it. The frontend adds pure override/merge helpers, an API client, and a dev-only "Translations" editor view.

**Tech Stack:** TypeScript, Vite 5, Vitest 2 (jsdom for DOM tests), Node 20 (built-in `http`/`fs`, ESM), Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-22-custom-translations-editor-design.md`

## Global Constraints

- Node sidecar has **zero npm dependencies** — built-in `node:http` / `node:fs` only.
- Sidecar is **ESM** (`translations-api/package.json` has `"type": "module"`); runnable with `node server.js`.
- Override rule everywhere: `displayed = overrides[locale]?.[originalName] ?? originalName`.
- Overrides are **per-locale, keyed by original name string**, global across versions/years.
- Applied at **render time** to both `celebration.name` and every `commemorations[]` string; never mutate input objects.
- Editor and all `/api` calls are **dev-only** — gated by `import.meta.env.DEV`; production build shows no nav and makes no API calls.
- A **cleared/empty field removes the key** (empty strings are never persisted).
- Sidecar port **8090**; data file **`liturgical-calendar/data/custom-translations.json`**.
- Tests live flat in `liturgical-calendar/tests/*.test.ts`; src UI imports use the `@engine/*` alias, tests import via relative `../src/...` paths.
- Run all tests with `npm test` (i.e. `vitest run`) from `liturgical-calendar/`; a single file with `npx vitest run tests/<file>.test.ts`.
- Type-only imports must use `import type { ... }` (importing `i18n.ts` for value at module top-level runs `localStorage`/`document` side effects that break the node test env).

---

## File Structure

- `liturgical-calendar/src/ui/overrides.ts` (new) — pure override/merge/row helpers + `Overrides` type.
- `liturgical-calendar/src/ui/translations-api.ts` (new) — `getOverrides` / `saveOverrides` HTTP client.
- `liturgical-calendar/src/ui/translations.ts` (new) — `renderTranslationsEditor` DOM view.
- `liturgical-calendar/translations-api/store.js` (new) — pure parse/validate/serialize.
- `liturgical-calendar/translations-api/server.js` (new) — HTTP server + testable `handleTranslationsRequest`.
- `liturgical-calendar/translations-api/package.json` (new) — `{"type":"module"}`.
- `liturgical-calendar/docker-compose.yml` (new) — sidecar service.
- `liturgical-calendar/vite.config.ts` (modify) — `/api` proxy.
- `liturgical-calendar/src/ui/app.ts` (modify) — state, init, render overlay, third view, dev nav.
- `liturgical-calendar/src/ui/index.html` (modify) — nav button + editor container.
- `liturgical-calendar/src/ui/styles.css` (modify) — editor styles.
- `liturgical-calendar/src/ui/i18n/locales/{en,pt,la}.json` (modify) — editor strings.
- `.gitignore` (modify, repo root) — ignore the data file.
- Tests (new): `tests/overrides.test.ts`, `tests/translations-store.test.ts`, `tests/translations-server.test.ts`, `tests/translations-api.test.ts`, `tests/translations-editor.test.ts`, `tests/i18n-translations-keys.test.ts`.

---

## Task 1: Override types + `applyOverrides`

**Files:**
- Create: `liturgical-calendar/src/ui/overrides.ts`
- Test: `liturgical-calendar/tests/overrides.test.ts`

**Interfaces:**
- Consumes: `CalendarDay` from `@engine/types`; `Locale` from `./i18n/i18n` (type-only).
- Produces:
  - `export type LocaleOverrides = Record<string, string>`
  - `export type Overrides = Partial<Record<Locale, LocaleOverrides>>`
  - `export function applyOverrides(days: CalendarDay[], overrides: Overrides, locale: Locale): CalendarDay[]`

- [ ] **Step 1: Write the failing test**

Create `liturgical-calendar/tests/overrides.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyOverrides, type Overrides } from '../src/ui/overrides';
import type { CalendarDay } from '../src/engine/types';

function makeDay(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: '2026-12-25',
    season: 'christmas',
    weekRef: 'Nat',
    celebration: { name: 'In Nativitate Domini', rank: 6, rankName: 'Duplex I classis', source: 'temporal' },
    color: 'white',
    commemorations: [],
    ...overrides,
  };
}

describe('applyOverrides', () => {
  it('supersedes the celebration name when an override exists', () => {
    const ov: Overrides = { en: { 'In Nativitate Domini': 'Christmas Day' } };
    const [day] = applyOverrides([makeDay()], ov, 'en');
    expect(day.celebration.name).toBe('Christmas Day');
  });

  it('falls back to the original name when no override exists', () => {
    const [day] = applyOverrides([makeDay()], { en: {} }, 'en');
    expect(day.celebration.name).toBe('In Nativitate Domini');
  });

  it('isolates overrides per locale', () => {
    const ov: Overrides = { pt: { 'In Nativitate Domini': 'Natal do Senhor' } };
    const [day] = applyOverrides([makeDay()], ov, 'en');
    expect(day.celebration.name).toBe('In Nativitate Domini');
  });

  it('overrides commemoration strings too', () => {
    const ov: Overrides = { en: { 'S. Anastasiae': 'St Anastasia' } };
    const [day] = applyOverrides([makeDay({ commemorations: ['S. Anastasiae', 'Other'] })], ov, 'en');
    expect(day.commemorations).toEqual(['St Anastasia', 'Other']);
  });

  it('does not mutate the input day objects', () => {
    const input = makeDay();
    applyOverrides([input], { en: { 'In Nativitate Domini': 'Christmas Day' } }, 'en');
    expect(input.celebration.name).toBe('In Nativitate Domini');
  });

  it('returns the same array contents when the locale has no map', () => {
    const days = [makeDay()];
    expect(applyOverrides(days, {}, 'en')[0].celebration.name).toBe('In Nativitate Domini');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd liturgical-calendar && npx vitest run tests/overrides.test.ts`
Expected: FAIL — cannot resolve `../src/ui/overrides`.

- [ ] **Step 3: Write minimal implementation**

Create `liturgical-calendar/src/ui/overrides.ts`:

```ts
/**
 * overrides.ts — Custom day-name override helpers (pure, non-mutating).
 *
 * Overrides are keyed per-locale by the ORIGINAL name string:
 *   displayed = overrides[locale]?.[originalName] ?? originalName
 */

import type { CalendarDay } from '@engine/types';
import type { Locale } from './i18n/i18n';

export type LocaleOverrides = Record<string, string>;
export type Overrides = Partial<Record<Locale, LocaleOverrides>>;

/** Apply per-locale overrides to celebration names and commemorations. */
export function applyOverrides(
  days: CalendarDay[],
  overrides: Overrides,
  locale: Locale,
): CalendarDay[] {
  const map = overrides[locale];
  if (!map) return days;

  return days.map((day) => {
    const name = map[day.celebration.name] ?? day.celebration.name;
    const commemorations = day.commemorations.map((c) => map[c] ?? c);

    const nameChanged = name !== day.celebration.name;
    const commsChanged = commemorations.some((c, i) => c !== day.commemorations[i]);
    if (!nameChanged && !commsChanged) return day;

    return {
      ...day,
      celebration: { ...day.celebration, name },
      commemorations,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd liturgical-calendar && npx vitest run tests/overrides.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/ui/overrides.ts liturgical-calendar/tests/overrides.test.ts
git commit -m "feat(litcal): add applyOverrides for per-locale day-name overrides"
```

---

## Task 2: `buildEditorRows` + `mergeLocaleOverrides`

**Files:**
- Modify: `liturgical-calendar/src/ui/overrides.ts`
- Test: `liturgical-calendar/tests/overrides.test.ts` (append)

**Interfaces:**
- Consumes: `Overrides`, `CalendarDay`, `Locale` (as in Task 1).
- Produces:
  - `export interface EditorRow { original: string; custom: string }`
  - `export function buildEditorRows(days: CalendarDay[], overrides: Overrides, locale: Locale): EditorRow[]`
  - `export function mergeLocaleOverrides(overrides: Overrides, locale: Locale, edits: Record<string, string>): Overrides`

- [ ] **Step 1: Write the failing test**

Append to `liturgical-calendar/tests/overrides.test.ts`:

```ts
import { buildEditorRows, mergeLocaleOverrides } from '../src/ui/overrides';

describe('buildEditorRows', () => {
  it('dedupes celebration + commemoration names and sorts them', () => {
    const days = [
      makeDay({ celebration: { name: 'Beta', rank: 1, rankName: 'x', source: 'temporal' }, commemorations: ['Alpha'] }),
      makeDay({ celebration: { name: 'Beta', rank: 1, rankName: 'x', source: 'temporal' }, commemorations: ['Gamma'] }),
    ];
    const rows = buildEditorRows(days, {}, 'en');
    expect(rows.map((r) => r.original)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('unions existing override keys not present in the calendar', () => {
    const days = [makeDay({ celebration: { name: 'Beta', rank: 1, rankName: 'x', source: 'temporal' } })];
    const rows = buildEditorRows(days, { en: { Zeta: 'Z!' } }, 'en');
    expect(rows.map((r) => r.original)).toEqual(['Beta', 'Zeta']);
  });

  it('fills custom values from the override map for the locale', () => {
    const days = [makeDay({ celebration: { name: 'Beta', rank: 1, rankName: 'x', source: 'temporal' } })];
    const rows = buildEditorRows(days, { en: { Beta: 'B!' } }, 'en');
    expect(rows.find((r) => r.original === 'Beta')?.custom).toBe('B!');
  });

  it('returns [] for an empty calendar with no overrides', () => {
    expect(buildEditorRows([], {}, 'en')).toEqual([]);
  });
});

describe('mergeLocaleOverrides', () => {
  it('sets the locale map from edits, trimming values', () => {
    const next = mergeLocaleOverrides({}, 'en', { Beta: '  B!  ' });
    expect(next.en).toEqual({ Beta: 'B!' });
  });

  it('drops empty / whitespace-only edits (clears the override)', () => {
    const next = mergeLocaleOverrides({ en: { Beta: 'B!' } }, 'en', { Beta: '   ', Gamma: '' });
    expect(next.en).toEqual({});
  });

  it('does not affect other locales', () => {
    const next = mergeLocaleOverrides({ pt: { Beta: 'Bpt' } }, 'en', { Beta: 'Ben' });
    expect(next.pt).toEqual({ Beta: 'Bpt' });
    expect(next.en).toEqual({ Beta: 'Ben' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd liturgical-calendar && npx vitest run tests/overrides.test.ts`
Expected: FAIL — `buildEditorRows`/`mergeLocaleOverrides` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `liturgical-calendar/src/ui/overrides.ts`:

```ts
export interface EditorRow {
  original: string;
  custom: string;
}

/** Build the sorted, deduped editor row list for a locale. */
export function buildEditorRows(
  days: CalendarDay[],
  overrides: Overrides,
  locale: Locale,
): EditorRow[] {
  const names = new Set<string>();
  for (const day of days) {
    if (day.celebration.name) names.add(day.celebration.name);
    for (const c of day.commemorations) names.add(c);
  }
  const map = overrides[locale] ?? {};
  for (const key of Object.keys(map)) names.add(key);

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((original) => ({ original, custom: map[original] ?? '' }));
}

/** Replace a locale's override map from editor edits, pruning empty values. */
export function mergeLocaleOverrides(
  overrides: Overrides,
  locale: Locale,
  edits: Record<string, string>,
): Overrides {
  const map: LocaleOverrides = {};
  for (const [original, custom] of Object.entries(edits)) {
    const trimmed = custom.trim();
    if (trimmed) map[original] = trimmed;
  }
  return { ...overrides, [locale]: map };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd liturgical-calendar && npx vitest run tests/overrides.test.ts`
Expected: PASS (all overrides tests).

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/ui/overrides.ts liturgical-calendar/tests/overrides.test.ts
git commit -m "feat(litcal): add buildEditorRows and mergeLocaleOverrides helpers"
```

---

## Task 3: Sidecar store module (pure)

**Files:**
- Create: `liturgical-calendar/translations-api/store.js`
- Create: `liturgical-calendar/translations-api/package.json`
- Test: `liturgical-calendar/tests/translations-store.test.ts`

**Interfaces:**
- Produces (ESM named exports from `store.js`):
  - `export function parseOverrides(text: string): object` — parse text → object, `{}` on error/invalid.
  - `export function validateOverrides(obj: unknown): boolean` — true iff object-of-objects-of-strings.
  - `export function serializeOverrides(obj: object): string` — pretty JSON (2-space).

- [ ] **Step 1: Write the failing test**

Create `liturgical-calendar/tests/translations-store.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseOverrides, validateOverrides, serializeOverrides } from '../translations-api/store.js';

describe('validateOverrides', () => {
  it('accepts an object of locale maps of strings', () => {
    expect(validateOverrides({ en: { A: 'a' }, pt: {} })).toBe(true);
  });
  it('accepts an empty object', () => {
    expect(validateOverrides({})).toBe(true);
  });
  it('rejects arrays', () => {
    expect(validateOverrides([])).toBe(false);
  });
  it('rejects null', () => {
    expect(validateOverrides(null)).toBe(false);
  });
  it('rejects non-string leaf values', () => {
    expect(validateOverrides({ en: { A: 5 } })).toBe(false);
  });
  it('rejects non-object locale values', () => {
    expect(validateOverrides({ en: 'nope' })).toBe(false);
  });
});

describe('parseOverrides', () => {
  it('parses valid JSON', () => {
    expect(parseOverrides('{"en":{"A":"a"}}')).toEqual({ en: { A: 'a' } });
  });
  it('returns {} for malformed JSON', () => {
    expect(parseOverrides('{not json')).toEqual({});
  });
  it('returns {} for valid JSON of the wrong shape', () => {
    expect(parseOverrides('[1,2,3]')).toEqual({});
  });
});

describe('serializeOverrides', () => {
  it('pretty-prints with 2-space indent', () => {
    expect(serializeOverrides({ en: { A: 'a' } })).toBe('{\n  "en": {\n    "A": "a"\n  }\n}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd liturgical-calendar && npx vitest run tests/translations-store.test.ts`
Expected: FAIL — cannot resolve `../translations-api/store.js`.

- [ ] **Step 3: Write minimal implementation**

Create `liturgical-calendar/translations-api/package.json`:

```json
{
  "name": "translations-api",
  "private": true,
  "type": "module"
}
```

Create `liturgical-calendar/translations-api/store.js`:

```js
/**
 * store.js — pure parse/validate/serialize for the overrides file.
 * Zero dependencies. ESM.
 */

/** True iff obj is an object whose values are objects of string values. */
export function validateOverrides(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return false;
  for (const localeMap of Object.values(obj)) {
    if (localeMap === null || typeof localeMap !== 'object' || Array.isArray(localeMap)) {
      return false;
    }
    for (const value of Object.values(localeMap)) {
      if (typeof value !== 'string') return false;
    }
  }
  return true;
}

/** Parse JSON text into an overrides object; {} on any error or bad shape. */
export function parseOverrides(text) {
  try {
    const obj = JSON.parse(text);
    return validateOverrides(obj) ? obj : {};
  } catch {
    return {};
  }
}

/** Pretty-print overrides as 2-space-indented JSON. */
export function serializeOverrides(obj) {
  return JSON.stringify(obj, null, 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd liturgical-calendar && npx vitest run tests/translations-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/translations-api/store.js liturgical-calendar/translations-api/package.json liturgical-calendar/tests/translations-store.test.ts
git commit -m "feat(litcal): add translations sidecar store module"
```

---

## Task 4: Sidecar HTTP server + Docker Compose + Vite proxy

**Files:**
- Create: `liturgical-calendar/translations-api/server.js`
- Create: `liturgical-calendar/docker-compose.yml`
- Modify: `liturgical-calendar/vite.config.ts`
- Test: `liturgical-calendar/tests/translations-server.test.ts`

**Interfaces:**
- Consumes: `store.js` exports (Task 3).
- Produces (ESM named exports from `server.js`):
  - `export async function handleTranslationsRequest(method: string, url: string, bodyText: string, store: { read: () => Promise<object>, write: (o: object) => Promise<void> }): Promise<{ status: number, body: object }>`
  - (default runtime side effect: starts an `http` server when run as `node server.js`.)

- [ ] **Step 1: Write the failing test**

Create `liturgical-calendar/tests/translations-server.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd liturgical-calendar && npx vitest run tests/translations-server.test.ts`
Expected: FAIL — cannot resolve `../translations-api/server.js`.

- [ ] **Step 3: Write minimal implementation**

Create `liturgical-calendar/translations-api/server.js`:

```js
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
    let bodyText = '';
    for await (const chunk of req) bodyText += chunk;
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
```

Create `liturgical-calendar/docker-compose.yml`:

```yaml
# Dev-only sidecar that persists custom liturgical day-name translations.
# Run from liturgical-calendar/:  docker compose up -d
# Then run the app with:          npm run dev   (Vite proxies /api -> :8090)

services:
  translations-api:
    image: node:20-alpine
    working_dir: /app
    command: node server.js
    environment:
      - PORT=8090
      - DATA_FILE=/data/custom-translations.json
    volumes:
      - ./translations-api:/app
      - ./data:/data
    ports:
      - "8090:8090"
```

Modify `liturgical-calendar/vite.config.ts` — add a `server.proxy` block. Full file after edit:

```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/ui',
  base: '/divinum-officium/',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
    },
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd liturgical-calendar && npx vitest run tests/translations-server.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/translations-api/server.js liturgical-calendar/docker-compose.yml liturgical-calendar/vite.config.ts liturgical-calendar/tests/translations-server.test.ts
git commit -m "feat(litcal): add translations sidecar server, compose, and vite proxy"
```

---

## Task 5: Frontend API client

**Files:**
- Create: `liturgical-calendar/src/ui/translations-api.ts`
- Test: `liturgical-calendar/tests/translations-api.test.ts`

**Interfaces:**
- Consumes: `Overrides` from `./overrides` (Task 1).
- Produces:
  - `export async function getOverrides(): Promise<Overrides>` — GET `/api/translations`; `{}` on any failure.
  - `export async function saveOverrides(overrides: Overrides): Promise<void>` — PUT `/api/translations`; throws on non-OK.

- [ ] **Step 1: Write the failing test**

Create `liturgical-calendar/tests/translations-api.test.ts`:

```ts
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

  it('returns {} when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    expect(await getOverrides()).toEqual({});
  });

  it('returns {} when fetch throws (sidecar down)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    expect(await getOverrides()).toEqual({});
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd liturgical-calendar && npx vitest run tests/translations-api.test.ts`
Expected: FAIL — cannot resolve `../src/ui/translations-api`.

- [ ] **Step 3: Write minimal implementation**

Create `liturgical-calendar/src/ui/translations-api.ts`:

```ts
/**
 * translations-api.ts — dev-only client for the translations sidecar.
 * Same-origin /api is proxied to the sidecar by Vite in dev.
 */

import type { Overrides } from './overrides';

const API_URL = '/api/translations';

/** Fetch all overrides. Fails soft to {} if the sidecar is unavailable. */
export async function getOverrides(): Promise<Overrides> {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) return {};
    return (await res.json()) as Overrides;
  } catch {
    return {};
  }
}

/** Persist all overrides. Throws on failure so the editor can surface it. */
export async function saveOverrides(overrides: Overrides): Promise<void> {
  const res = await fetch(API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overrides),
  });
  if (!res.ok) {
    throw new Error(`Failed to save translations (HTTP ${res.status})`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd liturgical-calendar && npx vitest run tests/translations-api.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/ui/translations-api.ts liturgical-calendar/tests/translations-api.test.ts
git commit -m "feat(litcal): add translations API client"
```

---

## Task 6: i18n strings for the editor

**Files:**
- Modify: `liturgical-calendar/src/ui/i18n/locales/en.json`
- Modify: `liturgical-calendar/src/ui/i18n/locales/pt.json`
- Modify: `liturgical-calendar/src/ui/i18n/locales/la.json`
- Test: `liturgical-calendar/tests/i18n-translations-keys.test.ts`

**Interfaces:**
- Produces: i18n keys `nav.translations`, `translations.title`, `translations.search`, `translations.original`, `translations.custom`, `translations.save`, `translations.saved`, `translations.unsaved`, `translations.clear`, `translations.unavailable` in all three locale dictionaries.

- [ ] **Step 1: Write the failing test**

Create `liturgical-calendar/tests/i18n-translations-keys.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { setLocale, t } from '../src/ui/i18n/i18n';

const KEYS = [
  'nav.translations',
  'translations.title',
  'translations.search',
  'translations.original',
  'translations.custom',
  'translations.save',
  'translations.saved',
  'translations.unsaved',
  'translations.clear',
  'translations.unavailable',
];

describe('editor i18n keys', () => {
  for (const locale of ['en', 'pt', 'la'] as const) {
    it(`defines all editor keys for ${locale}`, () => {
      setLocale(locale);
      for (const key of KEYS) {
        // t() falls back to the key string itself when missing — so a present
        // key must resolve to something OTHER than the raw key.
        expect(t(key), `${locale}:${key}`).not.toBe(key);
      }
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd liturgical-calendar && npx vitest run tests/i18n-translations-keys.test.ts`
Expected: FAIL — keys resolve to the raw key string.

- [ ] **Step 3: Write minimal implementation**

In `liturgical-calendar/src/ui/i18n/locales/en.json`, add these keys (insert before the closing `}`; ensure the preceding line ends with a comma):

```json
  "nav.translations": "Translations",
  "translations.title": "Edit day-name translations",
  "translations.search": "Search names…",
  "translations.original": "Original name",
  "translations.custom": "Custom translation",
  "translations.save": "Save",
  "translations.saved": "Saved",
  "translations.unsaved": "Unsaved changes",
  "translations.clear": "Clear",
  "translations.unavailable": "Custom translations service unavailable."
```

In `liturgical-calendar/src/ui/i18n/locales/pt.json`, add:

```json
  "nav.translations": "Traduções",
  "translations.title": "Editar traduções dos nomes dos dias",
  "translations.search": "Buscar nomes…",
  "translations.original": "Nome original",
  "translations.custom": "Tradução personalizada",
  "translations.save": "Salvar",
  "translations.saved": "Salvo",
  "translations.unsaved": "Alterações não salvas",
  "translations.clear": "Limpar",
  "translations.unavailable": "Serviço de traduções personalizadas indisponível."
```

In `liturgical-calendar/src/ui/i18n/locales/la.json`, add:

```json
  "nav.translations": "Translationes",
  "translations.title": "Recensere translationes nominum dierum",
  "translations.search": "Quaerere nomina…",
  "translations.original": "Nomen originale",
  "translations.custom": "Translatio propria",
  "translations.save": "Servare",
  "translations.saved": "Servatum",
  "translations.unsaved": "Mutationes non servatae",
  "translations.clear": "Delere",
  "translations.unavailable": "Ministerium translationum propriarum non praesto est."
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd liturgical-calendar && npx vitest run tests/i18n-translations-keys.test.ts`
Expected: PASS (3 tests). If a JSON parse error occurs, check for a missing/extra comma at the insertion point.

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/ui/i18n/locales/en.json liturgical-calendar/src/ui/i18n/locales/pt.json liturgical-calendar/src/ui/i18n/locales/la.json liturgical-calendar/tests/i18n-translations-keys.test.ts
git commit -m "feat(litcal): add i18n strings for the translations editor"
```

---

## Task 7: Editor view (`renderTranslationsEditor`)

**Files:**
- Create: `liturgical-calendar/src/ui/translations.ts`
- Test: `liturgical-calendar/tests/translations-editor.test.ts`

**Interfaces:**
- Consumes: `CalendarDay` (`@engine/types`); `Locale`, `t` (`./i18n/i18n`); `buildEditorRows`, `mergeLocaleOverrides`, `Overrides` (`./overrides`); `escapeHtml` (`./app-utils`).
- Produces:
  - `export interface TranslationsEditorProps { days: CalendarDay[]; overrides: Overrides; locale: Locale; onSave: (next: Overrides) => Promise<void> }`
  - `export function renderTranslationsEditor(container: HTMLElement, props: TranslationsEditorProps): void`
- DOM contract (for consumers/tests): a search input `#tr-search`; one text input per row carrying `data-original="<name>"` with class `tr-input`; a save button `#tr-save`; a status element `#tr-status`.

- [ ] **Step 1: Write the failing test**

Create `liturgical-calendar/tests/translations-editor.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderTranslationsEditor } from '../src/ui/translations';
import { setLocale } from '../src/ui/i18n/i18n';
import type { CalendarDay } from '../src/engine/types';

function makeDay(name: string, commemorations: string[] = []): CalendarDay {
  return {
    date: '2026-01-01',
    season: 'christmas',
    weekRef: 'x',
    celebration: { name, rank: 1, rankName: 'x', source: 'temporal' },
    color: 'white',
    commemorations,
  };
}

describe('renderTranslationsEditor', () => {
  let container: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    setLocale('en');
    container = document.createElement('div');
  });

  it('renders one input row per unique name, pre-filled from overrides', () => {
    renderTranslationsEditor(container, {
      days: [makeDay('Beta'), makeDay('Alpha', ['Gamma'])],
      overrides: { en: { Beta: 'B!' } },
      locale: 'en',
      onSave: vi.fn(),
    });
    const inputs = container.querySelectorAll<HTMLInputElement>('.tr-input');
    expect(inputs.length).toBe(3); // Alpha, Beta, Gamma
    const beta = container.querySelector<HTMLInputElement>('.tr-input[data-original="Beta"]');
    expect(beta?.value).toBe('B!');
  });

  it('calls onSave with merged overrides (trimmed, empties pruned)', async () => {
    const onSave = vi.fn(async () => {});
    renderTranslationsEditor(container, {
      days: [makeDay('Beta'), makeDay('Alpha')],
      overrides: {},
      locale: 'en',
      onSave,
    });
    const alpha = container.querySelector<HTMLInputElement>('.tr-input[data-original="Alpha"]')!;
    alpha.value = '  A!  ';
    alpha.dispatchEvent(new Event('input', { bubbles: true }));
    container.querySelector<HTMLButtonElement>('#tr-save')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onSave).toHaveBeenCalledWith({ en: { Alpha: 'A!' } });
  });

  it('filters rows via the search box (case-insensitive)', () => {
    renderTranslationsEditor(container, {
      days: [makeDay('Beta'), makeDay('Alpha')],
      overrides: {},
      locale: 'en',
      onSave: vi.fn(),
    });
    const search = container.querySelector<HTMLInputElement>('#tr-search')!;
    search.value = 'alp';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const alphaRow = container.querySelector<HTMLElement>('.tr-row[data-original="Alpha"]')!;
    const betaRow = container.querySelector<HTMLElement>('.tr-row[data-original="Beta"]')!;
    expect(alphaRow.hidden).toBe(false);
    expect(betaRow.hidden).toBe(true);
  });

  it('shows an error status and keeps changes when onSave rejects', async () => {
    const onSave = vi.fn(async () => { throw new Error('boom'); });
    renderTranslationsEditor(container, {
      days: [makeDay('Alpha')],
      overrides: {},
      locale: 'en',
      onSave,
    });
    const alpha = container.querySelector<HTMLInputElement>('.tr-input[data-original="Alpha"]')!;
    alpha.value = 'A!';
    alpha.dispatchEvent(new Event('input', { bubbles: true }));
    container.querySelector<HTMLButtonElement>('#tr-save')!.click();
    await Promise.resolve();
    await Promise.resolve();
    const status = container.querySelector<HTMLElement>('#tr-status')!;
    expect(status.textContent).toMatch(/boom|unavailable/i);
    expect(alpha.value).toBe('A!');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd liturgical-calendar && npx vitest run tests/translations-editor.test.ts`
Expected: FAIL — cannot resolve `../src/ui/translations`.

- [ ] **Step 3: Write minimal implementation**

Create `liturgical-calendar/src/ui/translations.ts`:

```ts
/**
 * translations.ts — dev-only editor for custom liturgical day-name overrides.
 * Renders a searchable table; Save merges edits into the per-locale override
 * map and calls back to persist.
 */

import type { CalendarDay } from '@engine/types';
import type { Locale } from './i18n/i18n';
import { t } from './i18n/i18n';
import { buildEditorRows, mergeLocaleOverrides, type Overrides } from './overrides';
import { escapeHtml } from './app-utils';

export interface TranslationsEditorProps {
  days: CalendarDay[];
  overrides: Overrides;
  locale: Locale;
  onSave: (next: Overrides) => Promise<void>;
}

export function renderTranslationsEditor(
  container: HTMLElement,
  props: TranslationsEditorProps,
): void {
  const rows = buildEditorRows(props.days, props.overrides, props.locale);

  const rowsHtml = rows
    .map((r) => {
      const orig = escapeHtml(r.original);
      const val = escapeHtml(r.custom);
      return `<div class="tr-row" data-original="${orig}">
        <span class="tr-orig">${orig}</span>
        <input class="tr-input" type="text" data-original="${orig}" value="${val}"
               placeholder="${escapeHtml(r.original)}">
      </div>`;
    })
    .join('');

  container.innerHTML = `
    <div class="translations-editor">
      <h2>${escapeHtml(t('translations.title'))}</h2>
      <div class="tr-toolbar">
        <input id="tr-search" type="search" placeholder="${escapeHtml(t('translations.search'))}">
        <button id="tr-save" disabled>${escapeHtml(t('translations.save'))}</button>
        <span id="tr-status" class="tr-status"></span>
      </div>
      <div class="tr-head">
        <span>${escapeHtml(t('translations.original'))}</span>
        <span>${escapeHtml(t('translations.custom'))}</span>
      </div>
      <div class="tr-rows">${rowsHtml}</div>
    </div>
  `;

  const searchEl = container.querySelector<HTMLInputElement>('#tr-search')!;
  const saveEl = container.querySelector<HTMLButtonElement>('#tr-save')!;
  const statusEl = container.querySelector<HTMLElement>('#tr-status')!;

  let dirty = false;
  function markDirty(): void {
    dirty = true;
    saveEl.disabled = false;
    statusEl.textContent = t('translations.unsaved');
  }

  container.querySelectorAll<HTMLInputElement>('.tr-input').forEach((input) => {
    input.addEventListener('input', markDirty);
  });

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.trim().toLowerCase();
    container.querySelectorAll<HTMLElement>('.tr-row').forEach((row) => {
      const name = (row.getAttribute('data-original') || '').toLowerCase();
      row.hidden = q.length > 0 && !name.includes(q);
    });
  });

  saveEl.addEventListener('click', async () => {
    const edits: Record<string, string> = {};
    container.querySelectorAll<HTMLInputElement>('.tr-input').forEach((input) => {
      edits[input.getAttribute('data-original') || ''] = input.value;
    });
    const next = mergeLocaleOverrides(props.overrides, props.locale, edits);

    saveEl.disabled = true;
    try {
      await props.onSave(next);
      props.overrides = next;
      dirty = false;
      statusEl.textContent = t('translations.saved');
    } catch (err) {
      saveEl.disabled = false;
      const detail = err instanceof Error ? err.message : t('translations.unavailable');
      statusEl.textContent = detail;
    }
  });

  void dirty; // dirty is tracked for UI state; referenced to satisfy noUnusedLocals
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd liturgical-calendar && npx vitest run tests/translations-editor.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/ui/translations.ts liturgical-calendar/tests/translations-editor.test.ts
git commit -m "feat(litcal): add translations editor view"
```

---

## Task 8: Wire editor into the app (state, render overlay, nav, view)

**Files:**
- Modify: `liturgical-calendar/src/ui/app.ts`
- Modify: `liturgical-calendar/src/ui/index.html`
- Modify: `liturgical-calendar/src/ui/styles.css`

**Interfaces:**
- Consumes: `applyOverrides`, `Overrides` (`./overrides`); `getOverrides`, `saveOverrides` (`./translations-api`); `renderTranslationsEditor` (`./translations`).
- Produces: no new exports (app is the entrypoint). Adds `'translations'` to the view union and a dev-only nav button.

> This task has no isolated unit test (it is DOM/bootstrap wiring composed of already-tested units); it is verified by the full test suite still passing plus the manual end-to-end check in Task 9. Make the edits, then run the checks in Steps 4–5.

- [ ] **Step 1: Edit `index.html`**

Add a Translations button to the view-toggle group and a container in `<main>`. Replace the `view-toggle` div (lines ~26-29) with:

```html
      <div class="control-group view-toggle">
        <button id="btn-grid" class="active">Grid</button>
        <button id="btn-agenda">Agenda</button>
        <button id="btn-translations" class="hidden">Translations</button>
      </div>
```

Replace the `<main>` block (lines ~33-36) with:

```html
  <main>
    <div id="calendar-grid" class="view"></div>
    <div id="calendar-agenda" class="view hidden"></div>
    <div id="calendar-translations" class="view hidden"></div>
  </main>
```

- [ ] **Step 2: Edit `app.ts`**

(a) Add imports after the existing `./app-utils` import (line ~16):

```ts
import { applyOverrides, type Overrides } from './overrides';
import { getOverrides, saveOverrides } from './translations-api';
import { renderTranslationsEditor } from './translations';
```

(b) Change the view union in `AppState` (line ~44) and add `overrides`:

```ts
  currentView: 'grid' | 'agenda' | 'translations';
  currentLocale: Locale;
  yearDays: CalendarDay[];
  overrides: Overrides;
```

(c) In the `state` initializer (line ~51-58) add `overrides: {},` after `yearDays: []`:

```ts
  yearDays: [],
  overrides: {},
```

(d) Add DOM refs after the existing refs (line ~69). Add:

```ts
const btnTranslations   = document.getElementById('btn-translations')     as HTMLButtonElement;
const calendarTranslations = document.getElementById('calendar-translations') as HTMLDivElement;
```

(e) Replace `renderCurrentView()` (lines ~114-133) with an overlay-aware, three-view version:

```ts
function renderCurrentView(): void {
  if (state.currentView === 'translations') {
    renderTranslationsEditor(calendarTranslations, {
      days: state.yearDays,
      overrides: state.overrides,
      locale: state.currentLocale,
      onSave: async (next) => {
        await saveOverrides(next);
        state.overrides = next;
      },
    });
    return;
  }

  if (state.yearDays.length === 0) return;

  const days = applyOverrides(state.yearDays, state.overrides, state.currentLocale);

  if (state.currentView === 'grid') {
    renderGrid(calendarGrid, days, state.currentYear, state.currentMonth, handleMonthChange);
  } else {
    renderAgenda(calendarAgenda, days, state.currentYear, state.currentMonth);
  }
}
```

(f) Replace `switchView()` (lines ~166-182) to handle three views:

```ts
function switchView(view: 'grid' | 'agenda' | 'translations'): void {
  state.currentView = view;

  calendarGrid.classList.toggle('hidden', view !== 'grid');
  calendarAgenda.classList.toggle('hidden', view !== 'agenda');
  calendarTranslations.classList.toggle('hidden', view !== 'translations');

  btnGrid.classList.toggle('active', view === 'grid');
  btnAgenda.classList.toggle('active', view === 'agenda');
  btnTranslations.classList.toggle('active', view === 'translations');

  renderCurrentView();
}
```

(g) Add the nav button i18n label in `updateUIStrings()` — after `btnSubscribe.textContent = ...` (line ~223):

```ts
  btnTranslations.textContent = t('nav.translations');
```

(h) Add the click listener after the `btnAgenda` listener (line ~274):

```ts
btnTranslations.addEventListener('click', () => switchView('translations'));
```

(i) In `init()` (lines ~287-298), load overrides and reveal the dev-only nav. Replace the body of `init()` with:

```ts
async function init(): Promise<void> {
  populateVersionSelector();
  populateLanguageSelector();

  // Set year input to current year
  yearInput.value = String(state.currentYear);

  updateUIStrings();

  // Dev-only: enable the translations editor + load existing overrides.
  if (import.meta.env.DEV) {
    btnTranslations.classList.remove('hidden');
    state.overrides = await getOverrides();
  }

  // Initial data load and render
  await reloadAndRender();
}
```

- [ ] **Step 3: Edit `styles.css`** — append editor styles at the end of the file:

```css
/* ── Translations editor (dev-only) ─────────────────────────────────────── */
#btn-translations.hidden { display: none; }

.translations-editor { max-width: 900px; margin: 0 auto; }
.translations-editor h2 { margin: 0 0 0.75rem; }

.tr-toolbar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}
.tr-toolbar #tr-search { flex: 1; padding: 0.4rem 0.6rem; }
.tr-status { font-size: 0.85rem; opacity: 0.8; }

.tr-head, .tr-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  align-items: center;
}
.tr-head {
  font-weight: 600;
  border-bottom: 1px solid #ccc;
  padding-bottom: 0.35rem;
  margin-bottom: 0.35rem;
}
.tr-row { padding: 0.2rem 0; }
.tr-row[hidden] { display: none; }
.tr-orig { overflow-wrap: anywhere; }
.tr-input { padding: 0.35rem 0.5rem; width: 100%; box-sizing: border-box; }
```

- [ ] **Step 4: Run the full test suite + typecheck**

Run: `cd liturgical-calendar && npm test`
Expected: PASS — all suites green, including the pre-existing ones.

Run: `cd liturgical-calendar && npx tsc --noEmit -p tsconfig.json`
Expected: no type errors. (If `tsconfig.json` is not the UI config, use the config that covers `src/ui`, e.g. `npx vite build` also typechecks via esbuild; a clean `npm run build` in Task 9 is the backstop.)

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/ui/app.ts liturgical-calendar/src/ui/index.html liturgical-calendar/src/ui/styles.css
git commit -m "feat(litcal): wire dev-only translations editor into the app"
```

---

## Task 9: Ignore the data file + end-to-end verification

**Files:**
- Modify: `.gitignore` (repo root)

- [ ] **Step 1: Edit `.gitignore`** — add under the `# Node` section (near `dist/`):

```
# Local custom translations (dev-only, host-persisted)
liturgical-calendar/data/custom-translations.json
```

- [ ] **Step 2: Verify the ignore rule works**

Run: `git check-ignore -v liturgical-calendar/data/custom-translations.json`
Expected: prints the matching `.gitignore` line (rule matches).

- [ ] **Step 3: Start the sidecar and verify the API**

```bash
cd liturgical-calendar
docker compose up -d
curl -s http://localhost:8090/api/translations
# Expected: {}  (empty store on first run)
curl -s -X PUT http://localhost:8090/api/translations \
  -H 'Content-Type: application/json' \
  -d '{"en":{"In Nativitate Domini":"Christmas Day"}}'
# Expected: {"ok":true}
curl -s http://localhost:8090/api/translations
# Expected: {"en":{"In Nativitate Domini":"Christmas Day"}}
cat data/custom-translations.json
# Expected: the pretty-printed JSON on disk (persisted)
```

- [ ] **Step 4: Verify end-to-end in the browser**

```bash
# In liturgical-calendar/, with the sidecar still up:
npm run dev
```
Then, in the browser at the dev URL (`/divinum-officium/`):
- Confirm the **Translations** button is visible (dev mode).
- Set locale to English, open **Translations**, edit a day name, click **Save** → status shows "Saved".
- Switch back to **Grid**/**Agenda** → the edited name is shown in place of the original.
- Reload the page → the override persists (loaded from the sidecar).
- Confirm the ICS/JSON calendar data still loads (the `src/ui/data` junction from prior setup must exist; if names show as "not loaded", run `npm run generate-ics` first).

- [ ] **Step 5: Verify the production build has no editor**

```bash
cd liturgical-calendar && npm run build
```
Expected: build succeeds. Confirm `import.meta.env.DEV` gating means the built `dist/assets/*.js` does not enable the Translations button (it stays hidden) and makes no `/api` calls. (Spot-check: `grep -c "/api/translations" dist/assets/*.js` may still show the string from the client module, but the nav stays hidden and `getOverrides` is only called under `import.meta.env.DEV`, which is `false` in the build.)

- [ ] **Step 6: Stop the sidecar and commit**

```bash
cd liturgical-calendar && docker compose down
cd .. && git add .gitignore
git commit -m "chore(litcal): gitignore local custom-translations data file"
```

---

## Self-Review Notes

- **Spec coverage:** override semantics (Tasks 1), per-locale/global keys (Task 1–2), render-time overlay incl. commemorations (Task 1, wired Task 8), Docker sidecar + atomic write + recover-on-bad-file (Tasks 3–4), Vite proxy (Task 4), API client fail-soft (Task 5), dev-only editor + nav (Tasks 6–8), search/table/Save/dirty/error handling (Task 7), persistence file + gitignore (Task 9), production has no editor (Task 9 Step 5). All spec sections map to a task.
- **Type consistency:** `Overrides`/`LocaleOverrides`/`EditorRow` defined in Task 1–2 and consumed unchanged in Tasks 5, 7, 8; `handleTranslationsRequest` signature identical in Task 4 impl/test; `renderTranslationsEditor` props identical in Task 7 impl/test and Task 8 call site; i18n keys listed in Task 6 match those used in Task 7/8.
- **Known cosmetic:** `void dirty;` in Task 7 keeps `dirty` referenced; the flag is genuinely used to drive status/save-enable state. Remove if the project's lint allows unused locals.
