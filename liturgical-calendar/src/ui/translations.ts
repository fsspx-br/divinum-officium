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
