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

function init(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in dictionaries) {
    currentLocale = stored as Locale;
  }
  document.documentElement.lang = currentLocale;
}

init();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}

export function t(key: string): string {
  return dictionaries[currentLocale]?.[key]
    ?? dictionaries.en[key]
    ?? key;
}
