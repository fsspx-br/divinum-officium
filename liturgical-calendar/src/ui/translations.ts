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
  latinDays: CalendarDay[];
  overrides: Overrides;
  locale: Locale;
  onSave: (next: Overrides) => Promise<void>;
}

export function renderTranslationsEditor(
  container: HTMLElement,
  props: TranslationsEditorProps,
): void {
  const rows = buildEditorRows(props.days, props.latinDays, props.overrides, props.locale);

  const rowsHtml = rows
    .map((r) => {
      const orig = escapeHtml(r.original);
      const key = escapeHtml(r.key);
      const val = escapeHtml(r.custom);
      return `<div class="tr-row" data-original="${orig}" data-key="${key}" data-translated="${val}">
        <span class="tr-orig">${orig}</span>
        <input class="tr-input" type="text" data-key="${key}" data-default="${key}"
               value="${val}" placeholder="${key}">
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

  function markDirty(): void {
    saveEl.disabled = false;
    statusEl.textContent = t('translations.unsaved');
  }

  container.querySelectorAll<HTMLInputElement>('.tr-input').forEach((input) => {
    input.addEventListener('input', markDirty);
  });

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.trim().toLowerCase();
    container.querySelectorAll<HTMLElement>('.tr-row').forEach((row) => {
      const original = (row.getAttribute('data-original') || '').toLowerCase();
      const translated = (row.getAttribute('data-translated') || '').toLowerCase();
      row.hidden = q.length > 0 && !original.includes(q) && !translated.includes(q);
    });
  });

  saveEl.addEventListener('click', async () => {
    const edits: Record<string, string> = {};
    container.querySelectorAll<HTMLInputElement>('.tr-input').forEach((input) => {
      const key = input.getAttribute('data-key') || '';
      const defaultValue = input.getAttribute('data-default') || '';
      const value = input.value.trim();
      if (value && value !== defaultValue) edits[key] = value;
    });
    const next = mergeLocaleOverrides(props.overrides, props.locale, edits);

    saveEl.disabled = true;
    try {
      await props.onSave(next);
      props.overrides = next;
      statusEl.textContent = t('translations.saved');
    } catch (err) {
      saveEl.disabled = false;
      const detail = err instanceof Error ? err.message : t('translations.unavailable');
      statusEl.textContent = detail;
    }
  });
}
