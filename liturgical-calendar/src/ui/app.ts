/**
 * app.ts — Main UI application entry point
 *
 * Wires together:
 *  - Version selector
 *  - Year input
 *  - Grid / Agenda view toggle
 *  - Subscribe and ICS download buttons
 *  - Calendar data loading from pre-generated JSON
 */

import type { CalendarDay } from '@engine/types';
import { renderGrid } from './grid-view';
import { renderAgenda } from './agenda-view';
import { t, getLocale, setLocale, LOCALES, type Locale } from './i18n/i18n';
import {
  versionSlug,
  escapeHtml,
  isTranslationsEnabled,
  calendarSubscriptionUrl,
  calendarDownloadFilename,
} from './app-utils';
import { generateICS } from '../ics/generator';
import { applyOverrides, type Overrides } from './overrides';
import { getOverrides, saveOverrides } from './translations-api';
import { renderTranslationsEditor } from './translations';
import { CALENDAR_START_YEAR, CALENDAR_END_YEAR } from '../build/range';
import {
  getCanManageEvents,
  getCustomEvents,
  openDayEvents,
  type CustomEvent,
} from './custom-events';

// ── Version registry ────────────────────────────────────────────────────────

interface VersionEntry {
  label: string;
  slug: string;
}

// versionSlug and escapeHtml are imported from ./app-utils

const VERSIONS: VersionEntry[] = [
  { label: 'Rubrics 1960 - 1960',    slug: versionSlug('Rubrics 1960 - 1960') },
  { label: 'Divino Afflatu - 1954',  slug: versionSlug('Divino Afflatu - 1954') },
  { label: 'Divino Afflatu - 1939',  slug: versionSlug('Divino Afflatu - 1939') },
  { label: 'Tridentine - 1906',      slug: versionSlug('Tridentine - 1906') },
  { label: 'Tridentine - 1888',      slug: versionSlug('Tridentine - 1888') },
  { label: 'Tridentine - 1570',      slug: versionSlug('Tridentine - 1570') },
  { label: 'Reduced - 1955',         slug: versionSlug('Reduced - 1955') },
  { label: 'Monastic - 1963',        slug: versionSlug('Monastic - 1963') },
];

// ── Application State ───────────────────────────────────────────────────────

interface AppState {
  currentYear: number;
  currentMonth: number;
  currentVersion: VersionEntry;
  currentView: 'grid' | 'agenda' | 'translations';
  currentLocale: Locale;
  yearDays: CalendarDay[];
  latinDays: CalendarDay[];
  overrides: Overrides;
  customEvents: CustomEvent[];
  canManageEvents: boolean;
}

const today = new Date();

const state: AppState = {
  currentYear: today.getFullYear(),
  currentMonth: today.getMonth() + 1, // 1-based
  currentVersion: VERSIONS[0],
  currentView: 'grid',
  currentLocale: getLocale(),
  yearDays: [],
  latinDays: [],
  overrides: {},
  customEvents: [],
  canManageEvents: false,
};

// ── DOM References ──────────────────────────────────────────────────────────

const versionSelect  = document.getElementById('version-select')  as HTMLSelectElement;
const yearInput      = document.getElementById('year-input')       as HTMLInputElement;
const btnGrid        = document.getElementById('btn-grid')         as HTMLButtonElement;
const btnAgenda      = document.getElementById('btn-agenda')       as HTMLButtonElement;
const btnSubscribe   = document.getElementById('btn-subscribe')    as HTMLButtonElement;
const btnDownload    = document.getElementById('btn-download')     as HTMLButtonElement;
const langSelect     = document.getElementById('lang-select')      as HTMLSelectElement;
const calendarGrid   = document.getElementById('calendar-grid')    as HTMLDivElement;
const calendarAgenda = document.getElementById('calendar-agenda')  as HTMLDivElement;
const btnTranslations   = document.getElementById('btn-translations')     as HTMLButtonElement;
const calendarTranslations = document.getElementById('calendar-translations') as HTMLDivElement;

// ── Data Loading ────────────────────────────────────────────────────────────

/**
 * Fetch the pre-generated JSON for a given year + version slug.
 * Returns an empty array and shows an error message on failure.
 */
async function loadCalendarData(
  year: number,
  version: VersionEntry,
  locale: Locale = state.currentLocale,
): Promise<CalendarDay[]> {
  showLoading();
  const url = `./data/${locale}/${version.slug}/${year}.json`;
  try {
    const plainResponse = await fetch(url);
    if (plainResponse.ok) {
      try {
        return await plainResponse.json() as CalendarDay[];
      } catch {
        // Static SPA fallbacks can return index.html with HTTP 200 for a
        // missing JSON path. Try the compressed long-range asset next.
      }
    }

    const compressedResponse = await fetch(`${url}.gz`);
    if (!compressedResponse.ok || !compressedResponse.body) {
      throw new Error(`HTTP ${compressedResponse.status} – ${compressedResponse.statusText}`);
    }
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot read compressed calendar data.');
    }

    const stream = compressedResponse.body.pipeThrough(new DecompressionStream('gzip'));
    const json = await new Response(stream).text();
    return JSON.parse(json) as CalendarDay[];
  } catch (err) {
    const msg = t('states.error').replace('{version}', version.label).replace('{year}', String(year));
    const detail = err instanceof Error ? err.message : String(err);
    showError(`${msg}\n${detail}`);
    return [];
  }
}

// ── Rendering ───────────────────────────────────────────────────────────────

function showLoading(): void {
  const msg = `<p class="state-message">${escapeHtml(t('states.loading'))}</p>`;
  calendarGrid.innerHTML = msg;
  calendarAgenda.innerHTML = msg;
}

function showError(message: string): void {
  const html = `<p class="state-message error">${escapeHtml(message)}</p>`;
  calendarGrid.innerHTML = html;
  calendarAgenda.innerHTML = html;
}

// escapeHtml imported from ./app-utils

/**
 * Re-render whichever view is currently active, using the current state.
 */
function renderCurrentView(): void {
  if (state.currentView === 'translations') {
    renderTranslationsEditor(calendarTranslations, {
      days: state.yearDays,
      latinDays: state.latinDays,
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

  const handleDaySelect = (day: CalendarDay) => {
    openDayEvents({
      day,
      events: state.customEvents.filter((event) => event.date === day.date),
      canManage: state.canManageEvents,
      onChanged: async () => {
        await loadEventsForYear();
        renderCurrentView();
      },
    });
  };

  if (state.currentView === 'grid') {
    renderGrid(calendarGrid, days, state.currentYear, state.currentMonth, handleMonthChange, state.customEvents, handleDaySelect);
  } else {
    renderAgenda(calendarAgenda, days, state.currentYear, state.currentMonth, state.customEvents, handleDaySelect);
  }
}

async function loadEventsForYear(): Promise<void> {
  try {
    state.customEvents = await getCustomEvents(`${state.currentYear}-01-01`, `${state.currentYear + 1}-01-01`);
  } catch (error) {
    console.error('Could not load custom events:', error);
    state.customEvents = [];
  }
}

// ── Event Handlers ──────────────────────────────────────────────────────────

/**
 * Called when the user navigates to a different month (from grid view).
 * If the year changes, data is reloaded.
 */
async function handleMonthChange(newYear: number, newMonth: number): Promise<void> {
  if (newYear < CALENDAR_START_YEAR || newYear > CALENDAR_END_YEAR) return;

  const yearChanged = newYear !== state.currentYear;

  state.currentMonth = newMonth;
  state.currentYear = newYear;
  yearInput.value = String(newYear);

  if (yearChanged) {
    state.yearDays = await loadCalendarData(state.currentYear, state.currentVersion);
    state.latinDays = state.currentLocale === 'la'
      ? state.yearDays
      : await loadCalendarData(state.currentYear, state.currentVersion, 'la');
    await loadEventsForYear();
  }

  renderCurrentView();
}

/**
 * Reload data and re-render from scratch.
 */
async function reloadAndRender(): Promise<void> {
  state.yearDays = await loadCalendarData(state.currentYear, state.currentVersion);
  state.latinDays = state.currentLocale === 'la'
    ? state.yearDays
    : await loadCalendarData(state.currentYear, state.currentVersion, 'la');
  await loadEventsForYear();
  renderCurrentView();
}

/**
 * Switch between Grid and Agenda views without reloading data.
 */
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

// ── Version Selector Setup ──────────────────────────────────────────────────

function populateVersionSelector(): void {
  for (const v of VERSIONS) {
    const option = document.createElement('option');
    option.value = v.slug;
    option.textContent = v.label;
    versionSelect.appendChild(option);
  }
  // Select first option by default
  versionSelect.value = VERSIONS[0].slug;
}

// ── Language Selector Setup ──────────────────────────────────────────────────

function populateLanguageSelector(): void {
  for (const loc of LOCALES) {
    const option = document.createElement('option');
    option.value = loc.code;
    option.textContent = loc.label;
    langSelect.appendChild(option);
  }
  langSelect.value = state.currentLocale;
}

// ── UI String Updates ───────────────────────────────────────────────────────

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
  btnDownload.textContent = t('controls.download');
  btnTranslations.textContent = t('nav.translations');

  // Update data-i18n elements (footer legend)
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
}

// ── Subscribe Button ────────────────────────────────────────────────────────

/** Open the stable feed in the device's calendar subscription handler. */
function handleSubscribe(): void {
  window.location.href = calendarSubscriptionUrl(window.location.href);
}

/** Download the currently selected calendar as a localized ICS file. */
function handleDownload(): void {
  if (state.yearDays.length === 0) return;

  const days = applyOverrides(state.yearDays, state.overrides, state.currentLocale);
  const contents = generateICS(days, state.currentVersion.label, state.currentLocale);
  const blobUrl = URL.createObjectURL(new Blob([contents], {
    type: 'text/calendar;charset=utf-8',
  }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = calendarDownloadFilename(
    state.currentVersion.slug,
    state.currentYear,
    state.currentLocale,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

// ── Event Listeners ─────────────────────────────────────────────────────────

versionSelect.addEventListener('change', () => {
  const found = VERSIONS.find((v) => v.slug === versionSelect.value);
  if (found) {
    state.currentVersion = found;
    reloadAndRender();
  }
});

yearInput.addEventListener('change', () => {
  const newYear = parseInt(yearInput.value, 10);
  if (!isNaN(newYear) && newYear >= CALENDAR_START_YEAR && newYear <= CALENDAR_END_YEAR) {
    state.currentYear = newYear;
    reloadAndRender();
  }
});

// Also handle Enter key on year input
yearInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    yearInput.dispatchEvent(new Event('change'));
  }
});

btnGrid.addEventListener('click', () => switchView('grid'));
btnAgenda.addEventListener('click', () => switchView('agenda'));
btnTranslations.addEventListener('click', () => switchView('translations'));
btnSubscribe.addEventListener('click', handleSubscribe);
btnDownload.addEventListener('click', handleDownload);

langSelect.addEventListener('change', () => {
  const locale = langSelect.value as Locale;
  setLocale(locale);
  state.currentLocale = locale;
  updateUIStrings();
  reloadAndRender();
});

// ── Bootstrap ───────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  populateVersionSelector();
  populateLanguageSelector();

  // Set year input to current year
  yearInput.value = String(state.currentYear);

  updateUIStrings();
  state.canManageEvents = await getCanManageEvents();

  // Enable the editor in development or in an explicitly opted-in production build.
  if (isTranslationsEnabled(import.meta.env)) {
    const overrides = await getOverrides();
    if (overrides !== null) {
      state.overrides = overrides;
      btnTranslations.classList.remove('hidden');
    }
  }

  // Initial data load and render
  await reloadAndRender();
}

init().catch((err) => {
  console.error('Failed to initialise liturgical calendar UI:', err);
  showError(t('states.initError'));
});
