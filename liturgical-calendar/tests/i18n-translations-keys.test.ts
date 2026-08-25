// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { setLocale, t } from '../src/ui/i18n/i18n';

const KEYS = [
  'controls.download',
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
