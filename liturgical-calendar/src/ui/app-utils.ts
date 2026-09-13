/**
 * app-utils.ts — Pure utility functions used by the app module.
 *
 * Extracted to allow testing without triggering DOM side effects.
 */

/**
 * Convert a version label to a URL/filesystem-safe slug.
 * Must match the logic used in generate-ics.ts.
 */
export function versionSlug(version: string): string {
  return version.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface TranslationFeatureEnv {
  DEV?: boolean;
  VITE_ENABLE_TRANSLATIONS?: string;
}

/** Enable the translation editor in development or an explicit production build. */
export function isTranslationsEnabled(env: TranslationFeatureEnv): boolean {
  return env.DEV === true || env.VITE_ENABLE_TRANSLATIONS === 'true';
}

/** Build a portable WebCal link using the host that served the calendar UI. */
export function calendarSubscriptionUrl(pageUrl: string): string {
  const feedUrl = new URL('/calendars/rubrics-1960-pt.ics', pageUrl);
  return `webcal://${feedUrl.host}${feedUrl.pathname}${feedUrl.search}`;
}

/** Build a descriptive, filesystem-safe filename for a downloaded calendar. */
export function calendarDownloadFilename(
  versionSlug: string,
  year: number,
  locale: string,
): string {
  return `divinum-officium-${versionSlug}-${year}-${locale}.ics`;
}

/** Build a descriptive filename for the selected month's PDF calendar. */
export function calendarPdfFilename(
  versionSlug: string,
  year: number,
  month: number,
  locale: string,
): string {
  return `calendario-liturgico-${versionSlug}-${year}-${String(month).padStart(2, '0')}-${locale}.pdf`;
}

/** Years needed to print a complete Sunday-to-Sunday page around the month. */
export function calendarPdfDataYears(year: number, month: number): number[] {
  if (month === 1) return [year - 1, year];
  if (month === 12) return [year, year + 1];
  return [year];
}
