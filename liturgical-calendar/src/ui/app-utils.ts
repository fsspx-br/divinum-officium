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
