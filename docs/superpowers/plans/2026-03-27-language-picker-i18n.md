# Language Picker & i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a language picker (English, Português, Latina) to the liturgical calendar UI that translates both UI chrome and calendar data, sourcing translations from the legacy `web/www/horas/` directories at build time.

**Architecture:** A thin i18n module with JSON dictionaries handles UI strings via a `t(key)` function. The build script generates separate `data/{locale}/{version}/{year}.json` files by instantiating `LiturgicalCalendar` with different `officeDir` paths per locale. The language picker persists to `localStorage` and triggers both UI re-render and data re-fetch on change.

**Tech Stack:** TypeScript, Vite, Vitest, vanilla DOM

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/ui/i18n/locales/en.json` | English UI string dictionary |
| `src/ui/i18n/locales/pt.json` | Portuguese UI string dictionary |
| `src/ui/i18n/locales/la.json` | Latin UI string dictionary |
| `src/ui/i18n/i18n.ts` | i18n module: `t()`, `setLocale()`, `getLocale()`, locale types |
| `src/ui/app.ts` | Add language picker, locale-aware data URL, re-render on change |
| `src/ui/grid-view.ts` | Replace hardcoded month/day names with `t()` calls |
| `src/ui/agenda-view.ts` | Replace hardcoded month/day/color names with `t()` calls |
| `src/ui/index.html` | Add language `<select>` in header top-right, dynamic text elements |
| `src/ui/styles.css` | Style the language picker |
| `src/build/generate-ics.ts` | Generate per-locale JSON by passing different `officeDir` per locale |
| `tests/i18n.test.ts` | Tests for i18n module |

---

### Task 1: Create the i18n module and locale files

**Files:**
- Create: `src/ui/i18n/locales/en.json`
- Create: `src/ui/i18n/locales/pt.json`
- Create: `src/ui/i18n/locales/la.json`
- Create: `src/ui/i18n/i18n.ts`
- Test: `tests/i18n.test.ts`

- [ ] **Step 1: Write failing test for i18n module**

Create `tests/i18n.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale, getLocale, type Locale } from '../src/ui/i18n/i18n';

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
    setLocale('en');
  });

  it('defaults to English', () => {
    expect(getLocale()).toBe('en');
  });

  it('returns English string for known key', () => {
    expect(t('app.title')).toBe('Liturgical Calendar');
  });

  it('switches to Portuguese', () => {
    setLocale('pt');
    expect(getLocale()).toBe('pt');
    expect(t('app.title')).toBe('Calendário Litúrgico');
  });

  it('switches to Latin', () => {
    setLocale('la');
    expect(getLocale()).toBe('la');
    expect(t('app.title')).toBe('Calendarium Liturgicum');
  });

  it('falls back to English for missing key in Portuguese', () => {
    setLocale('pt');
    expect(t('states.error')).toBeTruthy();
  });

  it('returns key itself for completely unknown key', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('persists locale to localStorage', () => {
    setLocale('pt');
    expect(localStorage.getItem('locale')).toBe('pt');
  });

  it('reads locale from localStorage on getLocale', () => {
    localStorage.setItem('locale', 'la');
    // Reset internal state by re-importing or calling init
    setLocale(localStorage.getItem('locale') as Locale);
    expect(getLocale()).toBe('la');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd liturgical-calendar && npx vitest run tests/i18n.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create English locale file**

Create `src/ui/i18n/locales/en.json`:

```json
{
  "app.title": "Liturgical Calendar",
  "controls.version": "Version:",
  "controls.year": "Year:",
  "controls.grid": "Grid",
  "controls.agenda": "Agenda",
  "controls.subscribe": "Subscribe (.ics)",
  "controls.copied": "Copied!",
  "nav.prev": "‹ Prev",
  "nav.next": "Next ›",
  "months.1": "January",
  "months.2": "February",
  "months.3": "March",
  "months.4": "April",
  "months.5": "May",
  "months.6": "June",
  "months.7": "July",
  "months.8": "August",
  "months.9": "September",
  "months.10": "October",
  "months.11": "November",
  "months.12": "December",
  "days.0": "Sun",
  "days.1": "Mon",
  "days.2": "Tue",
  "days.3": "Wed",
  "days.4": "Thu",
  "days.5": "Fri",
  "days.6": "Sat",
  "colors.white": "White",
  "colors.red": "Red",
  "colors.green": "Green",
  "colors.violet": "Violet",
  "colors.rose": "Rose",
  "colors.black": "Black",
  "legend.powered": "Powered by",
  "states.loading": "Loading…",
  "states.noData": "No data available for this month.",
  "states.error": "Could not load calendar data for {version} {year}.",
  "states.initError": "Failed to initialise the application. Please reload the page.",
  "agenda.also": "Also:"
}
```

- [ ] **Step 4: Create Portuguese locale file**

Create `src/ui/i18n/locales/pt.json`:

```json
{
  "app.title": "Calendário Litúrgico",
  "controls.version": "Versão:",
  "controls.year": "Ano:",
  "controls.grid": "Grade",
  "controls.agenda": "Agenda",
  "controls.subscribe": "Inscrever (.ics)",
  "controls.copied": "Copiado!",
  "nav.prev": "‹ Anterior",
  "nav.next": "Próximo ›",
  "months.1": "Janeiro",
  "months.2": "Fevereiro",
  "months.3": "Março",
  "months.4": "Abril",
  "months.5": "Maio",
  "months.6": "Junho",
  "months.7": "Julho",
  "months.8": "Agosto",
  "months.9": "Setembro",
  "months.10": "Outubro",
  "months.11": "Novembro",
  "months.12": "Dezembro",
  "days.0": "Dom",
  "days.1": "Seg",
  "days.2": "Ter",
  "days.3": "Qua",
  "days.4": "Qui",
  "days.5": "Sex",
  "days.6": "Sáb",
  "colors.white": "Branco",
  "colors.red": "Vermelho",
  "colors.green": "Verde",
  "colors.violet": "Violeta",
  "colors.rose": "Rosa",
  "colors.black": "Preto",
  "legend.powered": "Desenvolvido com",
  "states.loading": "Carregando…",
  "states.noData": "Sem dados disponíveis para este mês.",
  "states.error": "Não foi possível carregar os dados do calendário para {version} {year}.",
  "states.initError": "Falha ao inicializar a aplicação. Por favor, recarregue a página.",
  "agenda.also": "Também:"
}
```

- [ ] **Step 5: Create Latin locale file**

Create `src/ui/i18n/locales/la.json`:

```json
{
  "app.title": "Calendarium Liturgicum",
  "controls.version": "Editio:",
  "controls.year": "Annus:",
  "controls.grid": "Tabula",
  "controls.agenda": "Ordo",
  "controls.subscribe": "Subscribe (.ics)",
  "controls.copied": "Copied!",
  "nav.prev": "‹ Prior",
  "nav.next": "Sequens ›",
  "months.1": "Ianuarius",
  "months.2": "Februarius",
  "months.3": "Martius",
  "months.4": "Aprilis",
  "months.5": "Maius",
  "months.6": "Iunius",
  "months.7": "Iulius",
  "months.8": "Augustus",
  "months.9": "September",
  "months.10": "October",
  "months.11": "November",
  "months.12": "December",
  "days.0": "Dom",
  "days.1": "Lun",
  "days.2": "Mar",
  "days.3": "Mer",
  "days.4": "Iov",
  "days.5": "Ven",
  "days.6": "Sab",
  "colors.white": "Albus",
  "colors.red": "Ruber",
  "colors.green": "Viridis",
  "colors.violet": "Violaceus",
  "colors.rose": "Rosaceus",
  "colors.black": "Niger",
  "legend.powered": "Powered by",
  "states.loading": "Loading…",
  "states.noData": "No data available for this month.",
  "states.error": "Could not load calendar data for {version} {year}.",
  "states.initError": "Failed to initialise the application. Please reload the page.",
  "agenda.also": "Also:"
}
```

Note: Latin falls back to English for technical strings (error messages, footer).

- [ ] **Step 6: Create i18n module**

Create `src/ui/i18n/i18n.ts`:

```typescript
/**
 * i18n.ts — Lightweight internationalisation module
 *
 * Loads flat JSON dictionaries per locale.
 * Exports t(key) for translations, setLocale/getLocale for state.
 * Persists locale choice to localStorage.
 */

import en from './locales/en.json';
import pt from './locales/pt.json';
import la from './locales/la.json';

export type Locale = 'en' | 'pt' | 'la';

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'la', label: 'Latina' },
];

type Dict = Record<string, string>;

const dictionaries: Record<Locale, Dict> = { en, pt, la };

const STORAGE_KEY = 'locale';

let currentLocale: Locale = 'en';

/**
 * Initialise locale from localStorage (if valid), otherwise default to 'en'.
 */
function init(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in dictionaries) {
    currentLocale = stored as Locale;
  }
}

init();

/**
 * Get the current locale code.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Set the active locale and persist to localStorage.
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}

/**
 * Translate a key using the current locale dictionary.
 * Falls back to English, then returns the key itself.
 */
export function t(key: string): string {
  return dictionaries[currentLocale]?.[key]
    ?? dictionaries.en[key]
    ?? key;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd liturgical-calendar && npx vitest run tests/i18n.test.ts`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add liturgical-calendar/src/ui/i18n/ liturgical-calendar/tests/i18n.test.ts
git commit -m "feat: add i18n module with EN/PT/LA locale dictionaries"
```

---

### Task 2: Add language picker to the HTML and CSS

**Files:**
- Modify: `src/ui/index.html`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Add language select to index.html**

In `src/ui/index.html`, modify the `<header>` to add a language picker in the top-right. Change the header to use a flex layout with the title on the left and the language picker on the right, with controls below:

```html
<header>
  <div class="header-top">
    <h1 id="app-title">Liturgical Calendar</h1>
    <div class="control-group">
      <select id="lang-select" aria-label="Language"></select>
    </div>
  </div>
  <div class="controls">
    <div class="control-group">
      <label for="version-select" id="label-version">Version:</label>
      <select id="version-select"></select>
    </div>
    <div class="control-group">
      <label for="year-input" id="label-year">Year:</label>
      <input type="number" id="year-input" min="1900" max="2100">
    </div>
    <div class="control-group view-toggle">
      <button id="btn-grid" class="active">Grid</button>
      <button id="btn-agenda">Agenda</button>
    </div>
    <button id="btn-subscribe" class="subscribe-btn">Subscribe (.ics)</button>
  </div>
</header>
```

Also update the footer legend items to have IDs for dynamic text:

```html
<footer>
  <div class="color-legend">
    <span class="legend-item">
      <span class="swatch swatch-white"></span><span data-i18n="colors.white">White</span>
    </span>
    <span class="legend-item">
      <span class="swatch swatch-red"></span><span data-i18n="colors.red">Red</span>
    </span>
    <span class="legend-item">
      <span class="swatch swatch-green"></span><span data-i18n="colors.green">Green</span>
    </span>
    <span class="legend-item">
      <span class="swatch swatch-violet"></span><span data-i18n="colors.violet">Violet</span>
    </span>
    <span class="legend-item">
      <span class="swatch swatch-rose"></span><span data-i18n="colors.rose">Rose</span>
    </span>
    <span class="legend-item">
      <span class="swatch swatch-black"></span><span data-i18n="colors.black">Black</span>
    </span>
  </div>
  <p><span data-i18n="legend.powered">Powered by</span> <a href="https://github.com/divinumofficium/divinum-officium">Divinum Officium</a></p>
</footer>
```

- [ ] **Step 2: Add CSS for language picker and header layout**

Add to `src/ui/styles.css`, replacing the existing header styles:

```css
/* Add inside Header & Controls section */

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
}

#lang-select {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  min-width: 100px;
}
```

Update the `@media (min-width: 640px)` block for header: remove the flex from `header` itself (since `.header-top` now handles the top row), and keep `.controls` as-is.

- [ ] **Step 3: Verify visually**

Run: `cd liturgical-calendar && npm run dev`
Open in browser. Confirm the language dropdown appears top-right and looks consistent with the existing controls. No functionality yet — just layout.

- [ ] **Step 4: Commit**

```bash
git add liturgical-calendar/src/ui/index.html liturgical-calendar/src/ui/styles.css
git commit -m "feat: add language picker to header layout"
```

---

### Task 3: Wire up i18n in app.ts and view files

**Files:**
- Modify: `src/ui/app.ts`
- Modify: `src/ui/grid-view.ts`
- Modify: `src/ui/agenda-view.ts`

- [ ] **Step 1: Update grid-view.ts to accept translations**

Replace the hardcoded `MONTH_NAMES` and `DAY_HEADERS` arrays. Instead of importing the i18n module directly (which would create coupling), have the render function accept translated strings. Update the module:

Replace the top constants and update `renderGrid` to use `t()`:

```typescript
import { t } from './i18n/i18n';

// Remove MONTH_NAMES and DAY_HEADERS constants

// In renderGrid, replace:
//   heading.textContent = `${MONTH_NAMES[month - 1]} ${year}`;
// with:
//   heading.textContent = `${t(`months.${month}`)} ${year}`;

// Replace:
//   prevBtn.textContent = '‹ Prev';
// with:
//   prevBtn.textContent = t('nav.prev');

// Replace:
//   nextBtn.textContent = 'Next ›';
// with:
//   nextBtn.textContent = t('nav.next');

// Replace the DAY_HEADERS loop:
//   for (const dayName of DAY_HEADERS) {
// with:
//   for (let d = 0; d < 7; d++) {
//     const th = document.createElement('th');
//     th.textContent = t(`days.${d}`);
//     headerRow.appendChild(th);
//   }
```

- [ ] **Step 2: Update agenda-view.ts to use i18n**

Replace hardcoded strings:

```typescript
import { t } from './i18n/i18n';

// Remove DOW_ABBR and MONTH_NAMES constants

// In renderAgenda, replace:
//   heading.textContent = `${MONTH_NAMES[month - 1]} ${year}`;
// with:
//   heading.textContent = `${t(`months.${month}`)} ${year}`;

// Replace:
//   msg.textContent = 'No data available for this month.';
// with:
//   msg.textContent = t('states.noData');

// Replace:
//   const dow = DOW_ABBR[dateObj.getDay()];
// with:
//   const dow = t(`days.${dateObj.getDay()}`);

// Replace capitalize(calDay.color):
//   colorLabel.textContent = t(`colors.${calDay.color}`);

// Replace capitalize(calDay.season.replace(...)):
//   seasonEl.textContent = capitalize(calDay.season.replace(/-/g, ' '));
// (keep this as-is — season names come from the engine and are not in the i18n dict)

// Replace:
//   comms.textContent = 'Also: ' + calDay.commemorations.join(', ');
// with:
//   comms.textContent = t('agenda.also') + ' ' + calDay.commemorations.join(', ');
```

- [ ] **Step 3: Wire up language picker in app.ts**

Add locale support to `app.ts`:

```typescript
import { t, getLocale, setLocale, LOCALES, type Locale } from './i18n/i18n';

// Add to AppState:
//   currentLocale: Locale;

// Add to state initialisation:
//   currentLocale: getLocale(),

// Add DOM reference:
const langSelect = document.getElementById('lang-select') as HTMLSelectElement;

// Add to data URL — change:
//   const url = `./data/${version.slug}/${year}.json`;
// to:
//   const url = `./data/${state.currentLocale}/${version.slug}/${year}.json`;

// Add populateLanguageSelector function:
function populateLanguageSelector(): void {
  for (const loc of LOCALES) {
    const option = document.createElement('option');
    option.value = loc.code;
    option.textContent = loc.label;
    langSelect.appendChild(option);
  }
  langSelect.value = state.currentLocale;
}

// Add updateUIStrings function to update all text elements:
function updateUIStrings(): void {
  const title = document.getElementById('app-title');
  if (title) title.textContent = t('app.title');

  const labelVersion = document.getElementById('label-version');
  if (labelVersion) labelVersion.textContent = t('controls.version');

  const labelYear = document.getElementById('label-year');
  if (labelYear) labelYear.textContent = t('controls.year');

  btnGrid.textContent = t('controls.grid');
  btnAgenda.textContent = t('controls.agenda');
  btnSubscribe.textContent = t('controls.subscribe');

  // Update data-i18n elements (footer legend)
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
}

// Add language change listener:
langSelect.addEventListener('change', () => {
  const locale = langSelect.value as Locale;
  setLocale(locale);
  state.currentLocale = locale;
  updateUIStrings();
  reloadAndRender();
});

// In init(), add:
//   populateLanguageSelector();
//   updateUIStrings();
// (before reloadAndRender)

// Update showLoading to use t():
//   const msg = `<p class="state-message">${t('states.loading')}</p>`;

// Update showError to use t():
//   Use the passed message parameter as-is (caller provides translated text)

// Update the error message in loadCalendarData:
//   showError(`${t('states.error').replace('{version}', version.label).replace('{year}', String(year))}\n${...}`);

// Update init catch:
//   showError(t('states.initError'));

// Update handleSubscribe 'Copied!' feedback:
//   btnSubscribe.textContent = t('controls.copied');
```

- [ ] **Step 4: Verify the UI updates correctly**

Run: `cd liturgical-calendar && npm run dev`
Open in browser. Switch between languages — UI labels should all change. Calendar data will fail to load (404) since per-locale JSON doesn't exist yet — that's expected.

- [ ] **Step 5: Commit**

```bash
git add liturgical-calendar/src/ui/app.ts liturgical-calendar/src/ui/grid-view.ts liturgical-calendar/src/ui/agenda-view.ts
git commit -m "feat: wire up i18n in app, grid-view, and agenda-view"
```

---

### Task 4: Update the build script for per-locale JSON generation

**Files:**
- Modify: `src/build/generate-ics.ts`

- [ ] **Step 1: Update build script to generate per-locale JSON**

Modify `src/build/generate-ics.ts` to iterate over locales. The key change: create a separate `LiturgicalCalendar` instance per locale, each pointing to a different `officeDir`.

Add locale configuration after the existing constants:

```typescript
// Add after OFFICE_DIR:
interface LocaleConfig {
  code: string;
  officeDir: string;
}

const LOCALES: LocaleConfig[] = [
  { code: 'en', officeDir: resolve(__dirname, '../../../web/www/horas/English') },
  { code: 'pt', officeDir: resolve(__dirname, '../../../web/www/horas/Portugues') },
  { code: 'la', officeDir: resolve(__dirname, '../../../web/www/horas/Latin') },
];
```

Update the `main()` function to loop over locales. For each locale, create a `LiturgicalCalendar` with that locale's `officeDir`, then generate JSON to `dist/data/{locale}/{version-slug}/{year}.json`:

```typescript
async function main(): Promise<void> {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];

  let totalFiles = 0;

  for (const locale of LOCALES) {
    console.log(`\n── Locale: ${locale.code} ──`);
    console.log(`  data:   ${DATA_DIR}`);
    console.log(`  office: ${locale.officeDir}`);

    const calendar = new LiturgicalCalendar(DATA_DIR, locale.officeDir);

    const available = new Set(calendar.getVersions());
    const validVersions = VERSIONS.filter((v) => available.has(v));

    for (const version of validVersions) {
      const slug = versionSlug(version);
      const jsonDir = resolve(DIST_DIR, 'data', locale.code, slug);
      mkdirSync(jsonDir, { recursive: true });

      // ICS only for the default locale (Latin) to avoid duplication
      if (locale.code === 'la') {
        const icsDir = resolve(DIST_DIR, 'ics', slug);
        mkdirSync(icsDir, { recursive: true });
      }

      for (const year of years) {
        process.stdout.write(`  [${locale.code}][${version}] ${year} … `);

        try {
          const days = calendar.getCalendarYear(year, version);

          // Write JSON
          const jsonContent = JSON.stringify(days, null, 2);
          const jsonPath = resolve(jsonDir, `${year}.json`);
          writeFileSync(jsonPath, jsonContent, 'utf8');
          totalFiles += 1;

          // Write ICS only for Latin
          if (locale.code === 'la') {
            const icsDir = resolve(DIST_DIR, 'ics', slug);
            const icsContent = generateICS(days, version);
            const icsPath = resolve(icsDir, `${year}.ics`);
            writeFileSync(icsPath, icsContent, 'utf8');
            totalFiles += 1;
          }

          console.log(`OK (${days.length} days)`);
        } catch (err) {
          console.error(`FAILED`);
          console.error(`    ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  console.log();
  console.log(`Done. ${totalFiles} files written to ${DIST_DIR}`);
}
```

- [ ] **Step 2: Run the build and verify output**

Run: `cd liturgical-calendar && npx tsx src/build/generate-ics.ts`
Expected: Creates `dist/data/en/`, `dist/data/pt/`, `dist/data/la/` directories with JSON files for each version/year. ICS files only in `dist/ics/`.

Verify: `ls dist/data/en/Rubrics-1960-1960/ && ls dist/data/pt/Rubrics-1960-1960/ && ls dist/data/la/Rubrics-1960-1960/`
Expected: Both directories contain year JSON files.

- [ ] **Step 3: Spot-check translations**

Run: `cd liturgical-calendar && node -e "const en = require('./dist/data/en/Rubrics-1960-1960/$(date +%Y).json'); const pt = require('./dist/data/pt/Rubrics-1960-1960/$(date +%Y).json'); console.log('EN:', en[0].celebration.name); console.log('PT:', pt[0].celebration.name);"`

Verify that the EN and PT celebration names differ (Portuguese names should come from the legacy Portugues directory).

- [ ] **Step 4: Commit**

```bash
git add liturgical-calendar/src/build/generate-ics.ts
git commit -m "feat: generate per-locale calendar JSON from legacy translations"
```

---

### Task 5: Update Vite config to copy locale data and run end-to-end verification

**Files:**
- Modify: `src/ui/app.ts` (if data path adjustment needed)

- [ ] **Step 1: Verify data path alignment**

The build script writes JSON to `dist/data/{locale}/{version}/{year}.json`.
The UI fetches from `./data/{locale}/{version}/{year}.json`.
The Vite dev server serves from `src/ui/` as root with `dist/` as build output.

For development, the pre-generated data needs to be accessible. Verify the Vite dev server can serve from `dist/data/` or adjust the public dir. If needed, add a `publicDir` to `vite.config.ts` pointing to `dist/` so the data files are served during development.

Check: `cd liturgical-calendar && cat vite.config.ts`

If the data files aren't served during dev, update `vite.config.ts`:

```typescript
server: {
  proxy: {},
},
publicDir: resolve(__dirname, 'dist'),
```

Or symlink `src/ui/data` → `dist/data` as before (check if this pattern already exists).

- [ ] **Step 2: Run the full dev stack**

Run: `cd liturgical-calendar && npx tsx src/build/generate-ics.ts && npm run dev`

Open in browser. Test:
1. Default loads English calendar data
2. Switch to Português — celebration names should change to Portuguese
3. Switch to Latina — celebration names should change to Latin
4. All UI labels update immediately on language switch
5. Language choice persists after page reload

- [ ] **Step 3: Run all existing tests to ensure no regressions**

Run: `cd liturgical-calendar && npx vitest run`
Expected: All tests pass (existing + new i18n tests).

- [ ] **Step 4: Commit any remaining adjustments**

```bash
git add -A liturgical-calendar/
git commit -m "feat: complete language picker with per-locale data loading"
```

---

### Task 6: Final cleanup and build verification

**Files:**
- All modified files

- [ ] **Step 1: Run production build**

Run: `cd liturgical-calendar && npm run build`
Expected: Vite builds successfully, output in `dist/`.

- [ ] **Step 2: Verify dist structure**

Run: `ls -la liturgical-calendar/dist/data/`
Expected: Three locale directories: `en/`, `pt/`, `la/`, each containing version subdirectories with year JSON files.

- [ ] **Step 3: Run all tests one final time**

Run: `cd liturgical-calendar && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
git add -A liturgical-calendar/
git commit -m "chore: final cleanup for i18n feature"
```
