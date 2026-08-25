import { describe, it, expect } from 'vitest';
import {
  versionSlug,
  escapeHtml,
  isTranslationsEnabled,
  calendarSubscriptionUrl,
  calendarDownloadFilename,
} from '../src/ui/app-utils';

describe('versionSlug', () => {
  it('converts version label to URL-safe slug', () => {
    expect(versionSlug('Rubrics 1960 - 1960')).toBe('Rubrics-1960-1960');
  });

  it('collapses multiple dashes', () => {
    expect(versionSlug('Divino Afflatu - 1954')).toBe('Divino-Afflatu-1954');
  });

  it('strips leading and trailing dashes', () => {
    expect(versionSlug('- test -')).toBe('test');
  });

  it('removes special characters', () => {
    expect(versionSlug('Test (version) #1')).toBe('Test-version-1');
  });

  it('handles simple strings without special chars', () => {
    expect(versionSlug('Tridentine')).toBe('Tridentine');
  });

  it('returns empty string for all-special-char input', () => {
    expect(versionSlug('---')).toBe('');
  });

  it('preserves case', () => {
    expect(versionSlug('Monastic - 1963')).toBe('Monastic-1963');
  });

  it('handles all known version labels consistently', () => {
    const versions = [
      'Rubrics 1960 - 1960',
      'Divino Afflatu - 1954',
      'Divino Afflatu - 1939',
      'Tridentine - 1906',
      'Tridentine - 1888',
      'Tridentine - 1570',
      'Reduced - 1955',
      'Monastic - 1963',
    ];
    for (const v of versions) {
      const slug = versionSlug(v);
      expect(slug).not.toContain(' ');
      expect(slug).not.toMatch(/^-|-$/);
      expect(slug).not.toMatch(/--/);
    }
  });
});

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than signs', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes greater-than signs', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes multiple special characters together', () => {
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
  });

  it('returns plain strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('isTranslationsEnabled', () => {
  it('enables translations during development', () => {
    expect(isTranslationsEnabled({ DEV: true })).toBe(true);
  });

  it('enables translations for an opted-in production build', () => {
    expect(isTranslationsEnabled({ DEV: false, VITE_ENABLE_TRANSLATIONS: 'true' })).toBe(true);
  });

  it('keeps translations hidden in production by default', () => {
    expect(isTranslationsEnabled({ DEV: false })).toBe(false);
    expect(isTranslationsEnabled({ DEV: false, VITE_ENABLE_TRANSLATIONS: 'false' })).toBe(false);
  });
});

describe('calendarSubscriptionUrl', () => {
  it('opens the stable public feed through the WebCal handler', () => {
    expect(calendarSubscriptionUrl('http://162.35.190.207/divinum-officium/'))
      .toBe('webcal://162.35.190.207/calendars/rubrics-1960-pt.ics');
  });

  it('keeps the serving host and port so deployments remain portable', () => {
    expect(calendarSubscriptionUrl('http://localhost:8080/divinum-officium/'))
      .toBe('webcal://localhost:8080/calendars/rubrics-1960-pt.ics');
  });
});

describe('calendarDownloadFilename', () => {
  it('describes the selected version, year, and locale', () => {
    expect(calendarDownloadFilename('Rubrics-1960-1960', 3000, 'pt'))
      .toBe('divinum-officium-Rubrics-1960-1960-3000-pt.ics');
  });
});
