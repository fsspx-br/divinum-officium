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
      latinDays: [makeDay('Beta'), makeDay('Alpha', ['Gamma'])],
      overrides: { en: { Beta: 'B!' } },
      locale: 'en',
      onSave: vi.fn(),
    });
    const inputs = container.querySelectorAll<HTMLInputElement>('.tr-input');
    expect(inputs.length).toBe(3); // Alpha, Beta, Gamma
    const beta = container.querySelector<HTMLInputElement>('.tr-input[data-key="Beta"]');
    expect(beta?.value).toBe('B!');
    const alpha = container.querySelector<HTMLInputElement>('.tr-input[data-key="Alpha"]');
    expect(alpha?.value).toBe('Alpha');
  });

  it('calls onSave with merged overrides (trimmed, empties pruned)', async () => {
    const onSave = vi.fn(async () => {});
    renderTranslationsEditor(container, {
      days: [makeDay('Beta'), makeDay('Alpha')],
      latinDays: [makeDay('Beta'), makeDay('Alpha')],
      overrides: {},
      locale: 'en',
      onSave,
    });
    const alpha = container.querySelector<HTMLInputElement>('.tr-input[data-key="Alpha"]')!;
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
      latinDays: [makeDay('Beta'), makeDay('Alpha')],
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
      latinDays: [makeDay('Alpha')],
      overrides: {},
      locale: 'en',
      onSave,
    });
    const alpha = container.querySelector<HTMLInputElement>('.tr-input[data-key="Alpha"]')!;
    alpha.value = 'A!';
    alpha.dispatchEvent(new Event('input', { bubbles: true }));
    container.querySelector<HTMLButtonElement>('#tr-save')!.click();
    await Promise.resolve();
    await Promise.resolve();
    const status = container.querySelector<HTMLElement>('#tr-status')!;
    expect(status.textContent).toMatch(/boom|unavailable/i);
    expect(alpha.value).toBe('A!');
  });

  it('renders the Latin name while saving against the localized source name', async () => {
    const onSave = vi.fn(async () => {});
    renderTranslationsEditor(container, {
      days: [makeDay('Natal do Senhor')],
      latinDays: [makeDay('In Nativitate Domini')],
      overrides: {},
      locale: 'pt',
      onSave,
    });

    const row = container.querySelector<HTMLElement>('.tr-row')!;
    expect(row.querySelector('.tr-orig')?.textContent).toBe('In Nativitate Domini');
    const input = row.querySelector<HTMLInputElement>('.tr-input')!;
    expect(input.value).toBe('Natal do Senhor');
    input.value = 'Natal';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    container.querySelector<HTMLButtonElement>('#tr-save')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onSave).toHaveBeenCalledWith({ pt: { 'Natal do Senhor': 'Natal' } });
  });

  it('removes an override when the value is restored to the built-in translation', async () => {
    const onSave = vi.fn(async () => {});
    renderTranslationsEditor(container, {
      days: [makeDay('Christmas')],
      latinDays: [makeDay('In Nativitate Domini')],
      overrides: { en: { Christmas: 'Christmas Day' } },
      locale: 'en',
      onSave,
    });

    const input = container.querySelector<HTMLInputElement>('.tr-input')!;
    expect(input.value).toBe('Christmas Day');
    input.value = 'Christmas';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    container.querySelector<HTMLButtonElement>('#tr-save')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onSave).toHaveBeenCalledWith({ en: {} });
  });
});
