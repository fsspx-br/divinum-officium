/**
 * store.js — pure parse/validate/serialize for the overrides file.
 * Zero dependencies. ESM.
 */

/** True iff obj is an object whose values are objects of string values. */
export function validateOverrides(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return false;
  for (const localeMap of Object.values(obj)) {
    if (localeMap === null || typeof localeMap !== 'object' || Array.isArray(localeMap)) {
      return false;
    }
    for (const value of Object.values(localeMap)) {
      if (typeof value !== 'string') return false;
    }
  }
  return true;
}

/** Parse JSON text into an overrides object; {} on any error or bad shape. */
export function parseOverrides(text) {
  try {
    const obj = JSON.parse(text);
    return validateOverrides(obj) ? obj : {};
  } catch {
    return {};
  }
}

/** Pretty-print overrides as 2-space-indented JSON. */
export function serializeOverrides(obj) {
  return JSON.stringify(obj, null, 2);
}
