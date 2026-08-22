# Custom Translations Editor — Design Spec

**Date:** 2026-08-22
**Status:** Approved (brainstorming) — ready for implementation planning
**Component:** `liturgical-calendar` (Vite static SPA + Docker dev sidecar)

## Problem

Liturgical day names shown in the calendar come from Divinum Officium's
official translations (baked into the pre-generated per-locale JSON at build
time). Some names are wrong or awkward. Maintainers need a way to **fix a day
name** so the corrected version supersedes the official one, while any name
without a custom fix **falls back to the original**. The custom translations
must be **persisted** so they are not lost across restarts/rebuilds.

## Decisions (from brainstorming)

- **Audience/storage:** Docker-backed persistence (a dev sidecar service).
- **Serving model:** **Local/dev only** for now. GitHub Pages stays a pure
  static site with no editor and no backend. No production wiring in v1.
- **Persistence mechanism:** a small **Docker sidecar API** with a
  host-bind-mounted JSON file.

## Override Semantics & Data Model

- Overrides are stored **per-locale, keyed by the original name string**:

  ```json
  {
    "en": { "In Nativitate Domini": "Christmas Day" },
    "pt": { "In Nativitate Domini": "Natal do Senhor" },
    "la": {}
  }
  ```

- **Rule:** `displayed = overrides[locale]?.[originalName] ?? originalName`.
- Applied at **render time** to both `celebration.name` and each
  `commemorations[]` string (both are day-name strings in the same locale
  namespace). The generated JSON in `dist/data` is **never mutated**, so edits
  appear instantly and survive rebuilds.
- Overrides are **global across versions and years** — the key is
  `(locale, originalName)` only. Fixing a name fixes it everywhere it appears.
  Known consequence: two distinct days that share an original name get the same
  fix; this is intended for a name-fix tool.
- A **cleared field removes the key** (falls back to original). Empty string is
  never persisted as an override value.

## Architecture

### Backend — Docker sidecar (`translations-api`)

- New **`liturgical-calendar/docker-compose.yml`** (separate from the root
  Perl app's compose, to keep concerns apart). One service, stock
  `node:20-alpine`, **no custom image build**:

  ```yaml
  services:
    translations-api:
      image: node:20-alpine
      working_dir: /app
      command: node server.js
      volumes:
        - ./translations-api:/app        # zero-dependency server.js
        - ./data:/data                   # host-persisted overrides file
      ports:
        - "8090:8090"
  ```

- **`liturgical-calendar/translations-api/server.js`** — zero dependencies,
  built-in `http` + `fs`. Endpoints:
  - `GET /api/translations` → returns the full overrides object (`{}` if the
    file is missing or unparseable — recovers, never 500s on a bad file).
  - `PUT /api/translations` → validates the body is an object-of-objects-of-
    strings, then **atomically** writes it to `/data/custom-translations.json`
    (write temp file + rename).
  - Any other path/method → `404` / `405`.
- **Parse/merge/validate logic is factored into a pure module** (e.g.
  `translations-api/store.js`) so it is unit-testable without the HTTP layer.
- Port **8090**.

### Dev proxy

- **`liturgical-calendar/vite.config.ts`** adds:

  ```ts
  server: { proxy: { '/api': 'http://localhost:8090' } }
  ```

  The browser calls same-origin `/api/...` (absolute path, bypasses the
  `/divinum-officium/` base), so there is **no CORS** concern.

### Frontend

- **`src/ui/overrides.ts`** — pure functions:
  - `applyOverrides(days: CalendarDay[], overrides: Overrides, locale: Locale): CalendarDay[]`
    — returns new day objects with overridden `celebration.name` and
    `commemorations`. Non-mutating.
  - `buildEditorRows(days, overrides, locale): { original: string; custom: string }[]`
    — union of deduped celebration + commemoration names from `days` with the
    existing override keys for `locale`, sorted alphabetically.
- **`src/ui/translations-api.ts`** — `getOverrides(): Promise<Overrides>` and
  `saveOverrides(o: Overrides): Promise<void>`, both hitting `/api/translations`.
- **`src/ui/translations.ts`** — the editor view: renders the searchable table
  (*Original name* | *Custom translation* input | *clear*), tracks a dirty
  flag, and Save via `saveOverrides`.
- **Wiring in `src/ui/app.ts`:**
  - `AppState` gains `overrides: Overrides`.
  - On init, `getOverrides()` populates `state.overrides` (fail-soft to `{}`).
  - `renderCurrentView()` renders
    `applyOverrides(state.yearDays, state.overrides, state.currentLocale)`,
    keeping `state.yearDays` raw.
  - A third view `'translations'` is added alongside `'grid' | 'agenda'`.
- **Navigation:** a header **"Translations"** link/tab, shown **only in dev**
  (`import.meta.env.DEV`). In a production build the link is absent and no
  `/api` calls are made.

## Data Flow

1. App init → `getOverrides()` → `state.overrides`.
2. Load calendar JSON (unchanged) → `state.yearDays` (raw).
3. Render → `applyOverrides(raw, overrides, locale)` → grid/agenda show fixed
   names.
4. User opens Translations → `buildEditorRows` lists names → edits → **Save** →
   `saveOverrides` PUTs full object → sidecar writes
   `data/custom-translations.json` → `state.overrides` updated → returning to
   the calendar re-renders with the new overrides.

## Error Handling

- **Sidecar down / `getOverrides` fails:** fail soft to `{}`; the app shows
  original names. Optional small "custom translations unavailable" note in the
  editor.
- **Save fails:** show an error, keep the unsaved edits and the dirty flag.
- **Corrupt/missing overrides file server-side:** treated as `{}`.
- **Invalid PUT body:** `400`, file left unchanged.

## Testing

- **Vitest unit tests:**
  - `applyOverrides`: override supersedes original; missing key falls back;
    per-locale isolation (an `en` override does not affect `pt`);
    commemorations overridden; input not mutated.
  - `buildEditorRows`: dedup, union with existing override keys, sort, empty
    calendar.
  - Sidecar `store.js` pure logic: parse valid/invalid JSON → `{}`; validate
    good/bad PUT bodies; merge/serialize.
- HTTP layer gets light coverage only (pure logic carries the assertions).

## Storage / Persistence

- Overrides live at **`liturgical-calendar/data/custom-translations.json`**,
  bind-mounted into the sidecar, so the file persists on the host across
  container restarts and rebuilds.
- The file is **gitignored** in v1 (host-local personalization). Committing it
  is the future promotion path to production.

## Out of Scope (v1)

- Auth / multi-user concurrency (single-user dev tool; last write wins).
- Per-version or per-date override keys.
- Production / GitHub Pages wiring (no backend in prod).
- Editing anything other than celebration + commemoration name strings
  (colors, ranks, seasons, etc.).

## Affected / New Files

- **New:** `liturgical-calendar/docker-compose.yml`
- **New:** `liturgical-calendar/translations-api/server.js`
- **New:** `liturgical-calendar/translations-api/store.js`
- **New:** `liturgical-calendar/src/ui/overrides.ts`
- **New:** `liturgical-calendar/src/ui/translations-api.ts`
- **New:** `liturgical-calendar/src/ui/translations.ts`
- **New:** tests under the project's test layout for the above pure modules
- **Modified:** `liturgical-calendar/vite.config.ts` (proxy)
- **Modified:** `liturgical-calendar/src/ui/app.ts` (state, init, render, view,
  nav)
- **Modified:** `liturgical-calendar/src/ui/index.html` (Translations nav +
  editor container)
- **Modified:** `liturgical-calendar/src/ui/styles.css` (editor styles)
- **Modified:** `.gitignore` (root; add
  `liturgical-calendar/data/custom-translations.json`)
