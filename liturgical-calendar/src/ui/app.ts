/**
 * app.ts — Main UI application entry point
 *
 * Wires together:
 *  - Version selector
 *  - Year input
 *  - Grid / Agenda view toggle
 *  - Subscribe (.ics) button
 *  - Calendar data loading from pre-generated JSON
 */

import type { CalendarDay } from '@engine/types';
import { renderGrid } from './grid-view';
import { renderAgenda } from './agenda-view';
import { t, getLocale, setLocale, LOCALES, type Locale } from './i18n/i18n';

// ── Version registry ────────────────────────────────────────────────────────

interface VersionEntry {
  label: string;
  slug: string;
}

/**
 * Convert a version label to a URL/filesystem-safe slug.
 * Must match the logic used in generate-ics.ts.
 */
function versionSlug(version: string): string {
  return version.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

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
  currentView: 'grid' | 'agenda';
  currentLocale: Locale;
  yearDays: CalendarDay[];
}

const today = new Date();

const state: AppState = {
  currentYear: today.getFullYear(),
  currentMonth: today.getMonth() + 1, // 1-based
  currentVersion: VERSIONS[0],
  currentView: 'grid',
  currentLocale: getLocale(),
  yearDays: [],
};

// ── DOM References ──────────────────────────────────────────────────────────

const versionSelect  = document.getElementById('version-select')  as HTMLSelectElement;
const yearInput      = document.getElementById('year-input')       as HTMLInputElement;
const btnGrid        = document.getElementById('btn-grid')         as HTMLButtonElement;
const btnAgenda      = document.getElementById('btn-agenda')       as HTMLButtonElement;
const btnSubscribe   = document.getElementById('btn-subscribe')    as HTMLButtonElement;
const langSelect     = document.getElementById('lang-select')      as HTMLSelectElement;
const calendarGrid   = document.getElementById('calendar-grid')    as HTMLDivElement;
const calendarAgenda = document.getElementById('calendar-agenda')  as HTMLDivElement;

// ── Data Loading ────────────────────────────────────────────────────────────

/**
 * Fetch the pre-generated JSON for a given year + version slug.
 * Returns an empty array and shows an error message on failure.
 */
async function loadCalendarData(year: number, version: VersionEntry): Promise<CalendarDay[]> {
  showLoading();
  const url = `./data/${state.currentLocale}/${version.slug}/${year}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} – ${res.statusText}`);
    }
    const data: CalendarDay[] = await res.json();
    return data;
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Re-render whichever view is currently active, using the current state.
 */
function renderCurrentView(): void {
  if (state.yearDays.length === 0) return;

  if (state.currentView === 'grid') {
    renderGrid(
      calendarGrid,
      state.yearDays,
      state.currentYear,
      state.currentMonth,
      handleMonthChange,
    );
  } else {
    renderAgenda(
      calendarAgenda,
      state.yearDays,
      state.currentYear,
      state.currentMonth,
    );
  }
}

// ── Event Handlers ──────────────────────────────────────────────────────────

/**
 * Called when the user navigates to a different month (from grid view).
 * If the year changes, data is reloaded.
 */
async function handleMonthChange(newYear: number, newMonth: number): Promise<void> {
  const yearChanged = newYear !== state.currentYear;

  state.currentMonth = newMonth;
  state.currentYear = newYear;
  yearInput.value = String(newYear);

  if (yearChanged) {
    state.yearDays = await loadCalendarData(state.currentYear, state.currentVersion);
  }

  renderCurrentView();
}

/**
 * Reload data and re-render from scratch.
 */
async function reloadAndRender(): Promise<void> {
  state.yearDays = await loadCalendarData(state.currentYear, state.currentVersion);
  renderCurrentView();
}

/**
 * Switch between Grid and Agenda views without reloading data.
 */
function switchView(view: 'grid' | 'agenda'): void {
  state.currentView = view;

  if (view === 'grid') {
    calendarGrid.classList.remove('hidden');
    calendarAgenda.classList.add('hidden');
    btnGrid.classList.add('active');
    btnAgenda.classList.remove('active');
  } else {
    calendarAgenda.classList.remove('hidden');
    calendarGrid.classList.add('hidden');
    btnAgenda.classList.add('active');
    btnGrid.classList.remove('active');
  }

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

  // Update data-i18n elements (footer legend)
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
}

// ── Subscribe Button ────────────────────────────────────────────────────────

/**
 * Construct the ICS subscription URL for the current version and year,
 * then copy it to the clipboard (with a brief button label feedback).
 */
async function handleSubscribe(): Promise<void> {
  const icsUrl = new URL(
    `./ics/${state.currentVersion.slug}/${state.currentYear}.ics`,
    window.location.href,
  ).href;

  try {
    await navigator.clipboard.writeText(icsUrl);
    const original = btnSubscribe.textContent;
    btnSubscribe.textContent = t('controls.copied');
    setTimeout(() => {
      btnSubscribe.textContent = original;
    }, 2000);
  } catch {
    // Fallback: open the URL directly
    window.open(icsUrl, '_blank');
  }
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
  if (!isNaN(newYear) && newYear >= 1900 && newYear <= 2100) {
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
btnSubscribe.addEventListener('click', handleSubscribe);

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

  // Initial data load and render
  await reloadAndRender();
}

init().catch((err) => {
  console.error('Failed to initialise liturgical calendar UI:', err);
  showError(t('states.initError'));
});
