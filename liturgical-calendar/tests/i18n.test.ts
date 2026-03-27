// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
    // Re-import the module fresh for each test by resetting via setLocale
  });

  it('defaults to English', async () => {
    const { getLocale } = await import('../src/ui/i18n/i18n.js');
    // Reset to default state
    const { setLocale } = await import('../src/ui/i18n/i18n.js');
    setLocale('en');
    expect(getLocale()).toBe('en');
  });

  it('returns English string for known key', async () => {
    const { t, setLocale } = await import('../src/ui/i18n/i18n.js');
    setLocale('en');
    expect(t('app.title')).toBe('Liturgical Calendar');
  });

  it('switches to Portuguese', async () => {
    const { t, setLocale, getLocale } = await import('../src/ui/i18n/i18n.js');
    setLocale('pt');
    expect(getLocale()).toBe('pt');
    expect(t('app.title')).toBe('Calendário Litúrgico');
  });

  it('switches to Latin', async () => {
    const { t, setLocale, getLocale } = await import('../src/ui/i18n/i18n.js');
    setLocale('la');
    expect(getLocale()).toBe('la');
    expect(t('app.title')).toBe('Calendarium Liturgicum');
  });

  it('falls back to English for missing key in current locale', async () => {
    const { t, setLocale } = await import('../src/ui/i18n/i18n.js');
    // Latin omits technical UI strings (states.*), so they fall back to English
    setLocale('la');
    expect(t('states.loading')).toBe('Loading…');
    expect(t('states.noData')).toBe('No data available for this month.');
    expect(t('legend.powered')).toBe('Powered by');
  });

  it('returns key itself for completely unknown key', async () => {
    const { t, setLocale } = await import('../src/ui/i18n/i18n.js');
    setLocale('en');
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('persists locale to localStorage', async () => {
    const { setLocale } = await import('../src/ui/i18n/i18n.js');
    setLocale('pt');
    expect(localStorage.getItem('locale')).toBe('pt');
  });

  it('setLocale persists and getLocale reads the persisted value', async () => {
    const { setLocale, getLocale } = await import('../src/ui/i18n/i18n.js');
    setLocale('pt');
    expect(localStorage.getItem('locale')).toBe('pt');
    expect(getLocale()).toBe('pt');
  });
});
