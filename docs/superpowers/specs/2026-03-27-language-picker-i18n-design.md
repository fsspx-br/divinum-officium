# Language Picker & i18n for Liturgical Calendar UI

**Date:** 2026-03-27
**Scope:** Modern liturgical calendar UI (`liturgical-calendar/src/ui/`)
**Languages:** English (default), Português, Latina

---

## Overview

Add a language picker to the liturgical calendar UI that translates both UI chrome (labels, buttons, month/day names) and calendar data (celebration names, ranks, seasons, commemorations). Calendar data translations are sourced from the legacy `web/www/horas/` directory at build time.

## Requirements

- Language picker in the top-right corner of the header, visually separate from calendar controls
- Three languages at launch: English, Português, Latina
- Default language: English
- Language choice persists in `localStorage` across visits
- UI strings translated via JSON dictionaries
- Calendar data translated via per-locale build-time JSON generation, reading from legacy translation files

## Architecture

### UI Strings — `src/ui/i18n/`

**Files:**

- `locales/en.json` — English UI string dictionary
- `locales/pt.json` — Portuguese UI string dictionary
- `locales/la.json` — Latin UI string dictionary
- `i18n.ts` — i18n module exporting `t(key)`, `setLocale(locale)`, `getLocale()`

**Behavior:**

- `getLocale()` reads from `localStorage`, falls back to `'en'`
- `setLocale(locale)` saves to `localStorage`, updates the active dictionary
- `t(key)` returns the translated string for the current locale; falls back to English if key is missing
- `<html lang="">` attribute updates when locale changes

**Translation coverage (~30 keys):**

| Category | Keys |
|----------|------|
| App title | `app.title` |
| Control labels | `controls.version`, `controls.year`, `controls.grid`, `controls.agenda`, `controls.subscribe`, `controls.copied` |
| Navigation | `nav.prev`, `nav.next` |
| Month names | `months.1` through `months.12` |
| Day abbreviations | `days.0` (Sun) through `days.6` (Sat) |
| Liturgical colors | `colors.white`, `colors.red`, `colors.green`, `colors.violet`, `colors.rose`, `colors.black` |
| Footer | `legend.powered` |
| State messages | `states.loading`, `states.noData`, `states.error` |

For Latin, technical UI strings (error messages, footer) fall back to English.

### Calendar Data — Build-Time Generation

**Current:** `data/{version}/{year}.json`
**New:** `data/{locale}/{version}/{year}.json`

Example: `data/pt/Rubrics-1960-1960/2026.json`

**Locale-to-directory mapping:**

```
en → web/www/horas/English/
pt → web/www/horas/Portugues/
la → web/www/horas/Latin/
```

**Process:**

1. For each `(locale, version, year)` tuple, the build script reads from the corresponding legacy language directory (`Sancti/`, `Tempora/`, `Commune/`, etc.)
2. Extracts celebration names, rank names, season names, and commemorations
3. Outputs `CalendarDay[]` JSON with the same shape as today — only the text fields change per locale
4. Fallback chain: if a Portuguese translation is missing → Latin → English

### Language Picker Component

- `<select>` element in the top-right corner of the header
- Options: `English`, `Português`, `Latina`
- Compact style, separated from calendar-specific controls (Version, Year, Grid/Agenda)

### State Flow

```
User picks language
  → localStorage updated
  → UI strings re-render (month names, labels, buttons, legend, etc.)
  → Calendar JSON re-fetched from new locale path (data/{locale}/{version}/{year}.json)
  → Grid/Agenda views re-render with translated celebration data
```

### Files Modified

| File | Change |
|------|--------|
| `src/ui/index.html` | Add language `<select>` in header top-right; replace hardcoded text with IDs for dynamic update |
| `src/ui/app.ts` | Import i18n module; add language change handler; update data URL to include locale; re-render UI strings on locale change |
| `src/ui/grid-view.ts` | Replace hardcoded `MONTH_NAMES`, `DAY_HEADERS`, nav button text with `t()` calls |
| `src/ui/agenda-view.ts` | Replace hardcoded `DOW_ABBR`, `MONTH_NAMES`, color/season labels with `t()` calls |
| `src/ui/styles.css` | Style the top-right language picker |
| `src/ui/i18n/i18n.ts` | New — i18n module |
| `src/ui/i18n/locales/en.json` | New — English strings |
| `src/ui/i18n/locales/pt.json` | New — Portuguese strings |
| `src/ui/i18n/locales/la.json` | New — Latin strings |
| Build script | Extend to generate per-locale calendar JSON from legacy directories |

### New Files

- `src/ui/i18n/i18n.ts`
- `src/ui/i18n/locales/en.json`
- `src/ui/i18n/locales/pt.json`
- `src/ui/i18n/locales/la.json`

## Non-Goals

- No runtime translation API or external translation service
- No pluralization or interpolation (not needed for this UI surface)
- No changes to the legacy Perl/CGI application
- No languages beyond EN/PT/LA at launch (but the architecture supports adding more by adding a locale JSON + build config entry)
