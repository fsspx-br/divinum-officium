# Liturgical Calendar Extraction — Design Spec

## Goal

Extract the liturgical calendar computation logic from divinum-officium (Perl) into a standalone TypeScript library. The library powers two outputs:

1. **Static web UI** — month grid + agenda view for browsing the calendar
2. **ICS files** — subscribable `.ics` URLs hosted on GitHub Pages for Google Calendar integration

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Calendar versions | All (~12 versions, 1570–1963) | Maximum flexibility for all traditional rite users |
| Detail level | Name, rank, color, season | Enough for visual UI and meaningful calendar events |
| Target language | TypeScript | Natural fit for web UI, good ICS ecosystem |
| Extraction approach | Faithful port of Perl logic | Minimizes liturgical bugs; decades of corrections preserved |
| UI views | Month grid + agenda list with toggle | Covers both overview and detail use cases |
| Color derivation | Algorithmic from season + feast type | Follows traditional rubrical rules, no manual mapping |
| Hosting | GitHub Pages (static site + ICS files) | No server costs, stable subscription URLs, GitHub Actions for builds |
| ICS delivery | Static `.ics` files at stable URLs | Google Calendar polls public URLs as subscriptions |

## Architecture

Three layers:

### 1. Data Layer

The existing `web/www/Tabulae/` files from divinum-officium, copied into the new project's `data/` directory (keeps the project self-contained):

- `Kalendaria/*.txt` — sanctoral cycle (fixed feasts) per version
- `Tempora/*.txt` — temporal cycle (moveable seasons) per version
- `Transfer/*.txt` — Easter-dependent office transfers (by Easter letter a–g and Easter date 322–425)
- `Stransfer/*.txt` — scripture reading transfers
- `data.txt` — version registry with inheritance chains

These files are parsed at build time into typed TypeScript structures. The parser handles the custom `key=value;;version-filter` format used throughout.

### 2. Calendar Engine (TypeScript)

Faithful port of the Perl modules:

| TypeScript module | Perl source | Responsibility |
|-------------------|-------------|----------------|
| `date.ts` | `Date.pm` | Easter (Computus/Meeus), Advent start, `getWeek()` season mapper, leap year, day-of-week |
| `directorium.ts` | `Directorium.pm` | Feast lookup via `get_from_directorium()`, transfer loading by Easter letter, `transfered()` check |
| `occurrence.ts` | `horascommon.pl` (lines 20–371, 734–975, 1451–1739) | `occurrence()` — resolves temporal vs sanctoral winner; `concurrence()` — vespers precedence; `precedence()` — ranking logic |
| `color.ts` | New | Derives liturgical color from season + feast type (see Color Rules below) |
| `parser.ts` | New | Parses Tabulae file formats into typed structures |
| `calendar.ts` | New | Top-level API combining all modules |
| `types.ts` | New | Shared type definitions |

### 3. Output Layer

**ICS Generator** (`src/ics/generator.ts`):
- Produces one `.ics` file per version per year
- Each `VEVENT` is an all-day event with `SUMMARY` (celebration name + rank), `DESCRIPTION` (commemorations, transfer info), `CATEGORIES` (season, color)
- Generates current year + next year

**Static Web UI** (`src/ui/`):
- Vanilla TypeScript + CSS (no framework)
- Calendar engine runs client-side for instant year/version switching
- Controls: version selector, year picker, grid/agenda toggle, subscribe button

## Data Model

```typescript
interface CalendarDay {
  date: string;              // ISO date "2026-03-25"
  season: Season;
  weekRef: string;           // temporal code e.g. "Quad3-2"
  celebration: {
    name: string;            // "S. Joseph, Sponsi B.M.V."
    rank: number;            // 1–7 numeric rank
    rankName: string;        // "Duplex I classis"
    source: "temporal" | "sanctoral";
  };
  color: LiturgicalColor;
  commemorations: string[];  // names of commemorated offices
  transferredFrom?: string;  // original date if transferred
}

type Season = "advent" | "christmas" | "epiphany" | "lent"
            | "passiontide" | "easter" | "pentecost";

type LiturgicalColor = "white" | "red" | "green" | "violet" | "rose" | "black";

type CalendarVersion = string; // e.g. "Rubrics 1960 - 1960"
```

### Top-level API

```typescript
function getCalendarYear(year: number, version: CalendarVersion): CalendarDay[];
function getCalendarMonth(year: number, month: number, version: CalendarVersion): CalendarDay[];
function getCalendarDay(date: Date, version: CalendarVersion): CalendarDay;
```

## Liturgical Color Rules

Colors derived algorithmically from season + celebration type:

| Rule | Color | Condition |
|------|-------|-----------|
| Lent & Advent ferias | Violet | Weekdays in Lent/Advent without overriding feast |
| Gaudete Sunday (Advent 3) | Rose | Specific temporal code `Adv3-0` |
| Laetare Sunday (Lent 4) | Rose | Specific temporal code `Quad4-0` |
| Easter & Christmas seasons | White | Default for Pasc and Nat seasons |
| Post-Pentecost Sundays/ferias | Green | Pent season, no feast overriding |
| Martyrs | Red | Feast name/type contains "Martyr" |
| Confessors, Virgins, BVM, Angels | White | Feast type keywords |
| Apostles & Evangelists | Red | Feast references for apostles |
| Good Friday | Black | Specific date |
| Feasts of the Cross, Precious Blood | Red | Specific feast references |

Algorithm: check celebration-specific color first, then fall back to season default.

## ICS File Structure

### Generation

- GitHub Actions runs on push to main + yearly cron (January 1)
- Generates `.ics` for all versions x 2 years (current + next)
- Builds static UI
- Deploys to GitHub Pages

### URL Structure

```
https://<user>.github.io/liturgical-calendar/
├── index.html
├── assets/
├── ics/
│   ├── 1960/
│   │   ├── 2026.ics
│   │   └── 2027.ics
│   ├── 1570/
│   │   ├── 2026.ics
│   │   └── 2027.ics
│   └── ...
```

### ICS Event Format

```
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260307
DTEND;VALUE=DATE:20260308
SUMMARY:S. Thomae de Aquino — Duplex
DESCRIPTION:Comm: Feria\, Emb. Sabbato Quat. Temp.
CATEGORIES:lent,white
END:VEVENT
```

## Web UI

### Controls

- **Version dropdown** — all supported calendar versions
- **Year picker** — numeric input or dropdown
- **View toggle** — grid / agenda
- **Subscribe button** — copies or links to the `.ics` URL for the selected version

### Grid View

Monthly calendar grid (7 columns, Sun–Sat). Each cell shows:
- Day number
- Celebration name (abbreviated if needed)
- Background color badge matching liturgical color

Month navigation with prev/next arrows. Color legend at bottom.

### Agenda View

Scrollable day-by-day list. Each row shows:
- Date (day-of-week abbreviation + day number)
- Vertical color bar (liturgical color)
- Celebration name (full)
- Rank name, season, color label
- Commemorations (if any)

## Project Structure

```
liturgical-calendar/
├── src/
│   ├── engine/
│   │   ├── date.ts
│   │   ├── directorium.ts
│   │   ├── occurrence.ts
│   │   ├── color.ts
│   │   ├── parser.ts
│   │   ├── calendar.ts
│   │   └── types.ts
│   ├── ics/
│   │   └── generator.ts
│   ├── ui/
│   │   ├── index.html
│   │   ├── app.ts
│   │   └── styles.css
│   └── build/
│       └── generate-ics.ts
├── data/                    # Copy of web/www/Tabulae/ (not symlink, to keep the new project self-contained)
├── tests/
│   └── ...
├── package.json
├── tsconfig.json
└── .github/
    └── workflows/
        └── deploy.yml
```

### Tooling

- **TypeScript** — strict mode
- **Vite** — bundling the UI for production
- **vitest** — unit and integration tests

## Verification Strategy

Cross-check the TypeScript engine against the existing Perl output:

1. Run the Perl code to generate calendar data for a set of test years (varying Easter dates) across all versions
2. Run the TypeScript engine for the same inputs
3. Diff the outputs — any mismatch indicates a porting bug

Test years should cover edge cases: earliest Easter (March 22), latest Easter (April 25), leap years, years where major feasts collide.

## Scope Boundaries

**In scope:**
- Calendar computation engine (all versions)
- Liturgical color derivation
- ICS file generation
- Static web UI (grid + agenda)
- GitHub Actions + Pages deployment

**Out of scope:**
- Office content (prayers, readings, psalms) — only calendar metadata
- Real-time CalDAV server
- User accounts or personalization
- Mobile app
