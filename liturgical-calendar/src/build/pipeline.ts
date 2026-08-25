/**
 * pipeline.ts — Calendar post-processing pipeline functions
 *
 * Extracted from generate-ics.ts for testability. These functions transform
 * raw CalendarDay arrays by marking holy days, abstinence, and applying
 * locale-specific translations.
 */

import type { CalendarDay } from '../engine/types';
import { getAdvent, getEaster, ydaysToDate } from '../engine/date';

// ---------------------------------------------------------------------------
// Holy days of obligation
// ---------------------------------------------------------------------------

export interface HolyDayEntry {
  date: string;  // MM-DD for fixed, or keyword for moveable
  key: string;
}

export interface HolyDaysConfig {
  universal: HolyDayEntry[];
  [region: string]: HolyDayEntry[];
}

/** Name patterns for moveable feasts (key = date field from holy-days.json). */
export const MOVEABLE_FEAST_PATTERNS: Record<string, RegExp> = {
  'ascension': /^in ascensione domini$/i,
  'corpus-christi': /^festum sanctissimi corporis christi$/i,
};

/**
 * Mark holy days of obligation on CalendarDay objects.
 * Uses fixed dates from the config + name matching for moveable feasts.
 */
export function markHolyDays(
  days: CalendarDay[],
  config: HolyDaysConfig,
  regions: string[] = [],
): CalendarDay[] {
  // Collect all applicable entries: universal + selected regions
  const entries: HolyDayEntry[] = [
    ...config.universal,
    ...regions.flatMap((r) => config[r] ?? []),
  ];

  // Build set of fixed MM-DD dates
  const fixedDates = new Set<string>();
  const moveableKeys: string[] = [];
  for (const entry of entries) {
    if (/^\d{2}-\d{2}$/.test(entry.date)) {
      fixedDates.add(entry.date);
    } else {
      moveableKeys.push(entry.date);
    }
  }

  return days.map((day) => {
    const mmdd = day.date.slice(5); // "YYYY-MM-DD" → "MM-DD"
    const isSunday = new Date(day.date + 'T12:00:00').getDay() === 0;

    let isHolyDay = isSunday || fixedDates.has(mmdd);

    if (!isHolyDay) {
      for (const key of moveableKeys) {
        const pattern = MOVEABLE_FEAST_PATTERNS[key];
        if (pattern && pattern.test(day.celebration.name)) {
          isHolyDay = true;
          break;
        }
      }
    }

    return isHolyDay ? { ...day, holyDayOfObligation: true } : day;
  });
}

// ---------------------------------------------------------------------------
// Abstinence days
// ---------------------------------------------------------------------------

/** Celebration name patterns for Ash Wednesday and Good Friday. */
export const ASH_WEDNESDAY_PATTERN = /cinerum|cinzas/i;
export const GOOD_FRIDAY_PATTERN = /parasceve|sexta.feira santa/i;

/**
 * Mark abstinence days: every Friday + Ash Wednesday + Good Friday + Ember Days,
 * except Fridays that are holy days of obligation (feast overrides abstinence).
 */
export function markAbstinence(days: CalendarDay[]): CalendarDay[] {
  return days.map((day) => {
    const dow = new Date(day.date + 'T12:00:00').getDay();
    const isFriday = dow === 5;
    const isAshWednesday = ASH_WEDNESDAY_PATTERN.test(day.celebration.name);
    const isGoodFriday = GOOD_FRIDAY_PATTERN.test(day.celebration.name);

    // Fridays that are holy days of obligation are exempt from abstinence
    if (isFriday && day.holyDayOfObligation && !isGoodFriday && !day.isEmberDay) {
      return day;
    }

    if (isFriday || isAshWednesday || isGoodFriday || day.isEmberDay) {
      return { ...day, abstinence: true };
    }

    return day;
  });
}

// ---------------------------------------------------------------------------
// Ember Days (Têmporas)
// ---------------------------------------------------------------------------

const EMBER_WEEKDAY_OFFSETS = [3, 5, 6]; // Wednesday, Friday, Saturday after Sunday

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function firstSundayOfMonth(year: number, month: number): Date {
  const first = utcDate(year, month, 1);
  return addUtcDays(first, (7 - first.getUTCDay()) % 7);
}

function usesReformedSeptemberRule(version: string): boolean {
  if (/newcal/i.test(version)) return true;
  const rubricYear = Number(version.match(/\b(\d{4})\b/)?.[1] ?? 0);
  return rubricYear >= 1960;
}

/** Return all twelve Ember Day dates for a civil year. */
export function getEmberDays(
  year: number,
  version: string = 'Rubrics 1960 - 1960',
): string[] {
  const easterParts = getEaster(year);
  const easter = utcDate(easterParts.year, easterParts.month, easterParts.day);
  const adventParts = ydaysToDate(getAdvent(year), year);
  const firstAdventSunday = utcDate(adventParts.year, adventParts.month, adventParts.day);

  const sundayAnchors = [
    addUtcDays(easter, -42),       // First Sunday of Lent
    addUtcDays(easter, 49),        // Pentecost
    addUtcDays(firstAdventSunday, 14), // Third Sunday of Advent
  ];

  const dates = sundayAnchors.flatMap((anchor) =>
    EMBER_WEEKDAY_OFFSETS.map((offset) => toIsoDate(addUtcDays(anchor, offset))),
  );

  if (usesReformedSeptemberRule(version)) {
    const thirdSeptemberSunday = addUtcDays(firstSundayOfMonth(year, 9), 14);
    dates.push(...EMBER_WEEKDAY_OFFSETS.map(
      (offset) => toIsoDate(addUtcDays(thirdSeptemberSunday, offset)),
    ));
  } else {
    const holyCross = utcDate(year, 9, 14);
    const daysUntilWednesday = ((3 - holyCross.getUTCDay() + 7) % 7) || 7;
    const emberWednesday = addUtcDays(holyCross, daysUntilWednesday);
    dates.push(
      toIsoDate(emberWednesday),
      toIsoDate(addUtcDays(emberWednesday, 2)),
      toIsoDate(addUtcDays(emberWednesday, 3)),
    );
  }

  return dates.sort();
}

/** Determine whether an ISO civil date is an Ember Day. */
export function isEmberDay(
  date: string,
  version: string = 'Rubrics 1960 - 1960',
): boolean {
  const year = Number(date.match(/^(\d{4})-\d{2}-\d{2}$/)?.[1]);
  return Number.isInteger(year) && getEmberDays(year, version).includes(date);
}

/** Mark Ember Days without relying on localized celebration names. */
export function markEmberDays(
  days: CalendarDay[],
  version: string = 'Rubrics 1960 - 1960',
): CalendarDay[] {
  return days.map((day) => (
    isEmberDay(day.date, version) ? { ...day, isEmberDay: true } : day
  ));
}

// ---------------------------------------------------------------------------
// Portuguese translations
// ---------------------------------------------------------------------------

function normalizeLatinTranslationKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/æ/giu, 'ae')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/giu, '')
    .toLowerCase();
}

const PT_OCTAVE_FEASTS: Record<string, string> = Object.fromEntries(
  [
    ['Epiphaniæ', 'da Epifania'],
    ['S. Stephani Protomartyris', 'de Santo Estêvão, Primeiro Mártir'],
    ['S. Joannis Apostoli et Evangelistæ', 'de São João, Apóstolo e Evangelista'],
    ['Ss. Innocentium', 'dos Santos Inocentes'],
    ['Ascensionis', 'da Ascensão'],
    ['Nativitatis Beatæ Mariæ Virginis', 'da Natividade da Santíssima Virgem Maria'],
    ['S. Nativitatis Beatæ Mariæ Virginis', 'da Natividade da Santíssima Virgem Maria'],
    ['Nativitatis S. Joannis Baptistæ', 'da Natividade de São João Batista'],
    ['S. Joannis Baptistæ', 'de São João Batista'],
    ['Omnium Sanctorum', 'de Todos os Santos'],
    ['Assumptionis Beatæ Mariæ Virginis', 'da Assunção da Santíssima Virgem Maria'],
    ['S. Assumptionis Beatæ Mariæ Virginis', 'da Assunção da Santíssima Virgem Maria'],
    ['S. Laurentii Martyris', 'de São Lourenço, Mártir'],
    ['Ss. Apostolorum Petri et Pauli', 'dos Santos Apóstolos Pedro e Paulo'],
    ['SSmi Cordis Jesu', 'do Sagrado Coração de Jesus'],
    ['S. Joseph', 'de São José'],
    ['Patrocinii S. Joseph', 'do Patrocínio de São José'],
    ['Concept. Immac. Beatæ Mariæ Virginis', 'da Imaculada Conceição da Santíssima Virgem Maria'],
    ['Conceptionis Immaculatæ Beatæ Mariæ Virginis', 'da Imaculada Conceição da Santíssima Virgem Maria'],
  ].map(([latin, portuguese]) => [normalizeLatinTranslationKey(latin), portuguese]),
);

const PT_OCTAVE_ORDINALS: Record<string, string> = {
  ii: '2º',
  secunda: '2º',
  iii: '3º',
  tertia: '3º',
  iv: '4º',
  quarta: '4º',
  v: '5º',
  quinta: '5º',
  vi: '6º',
  sexta: '6º',
  vii: '7º',
  septima: '7º',
};

function translatePtOctaveName(name: string): string | undefined {
  const dayMatch = name.match(/^(?:De )?(.+?)\s+infra Octavam\s+(.+)$/iu);
  if (dayMatch) {
    const ordinalKey = dayMatch[1].replace(/\bdie\b/giu, '').trim().toLowerCase();
    const ordinal = PT_OCTAVE_ORDINALS[ordinalKey];
    const feast = PT_OCTAVE_FEASTS[normalizeLatinTranslationKey(dayMatch[2])];
    if (ordinal && feast) return `${ordinal} Dia na Oitava ${feast}`;
  }

  const sundayMatch = name.match(/^(?:De )?Dominica infra Octavam\s+(.+)$/iu);
  if (sundayMatch) {
    const feast = PT_OCTAVE_FEASTS[normalizeLatinTranslationKey(sundayMatch[1])];
    if (feast) return `Domingo na Oitava ${feast}`;
  }

  const octaveMatch = name.match(/^In Octavam?\s+(.+)$/iu);
  if (octaveMatch) {
    const feast = PT_OCTAVE_FEASTS[normalizeLatinTranslationKey(octaveMatch[1])];
    if (feast) return `Na Oitava ${feast}`;
  }

  return undefined;
}

function translatePtTemporalName(name: string): string | undefined {
  let translated = name;

  translated = translated
    .replace(/^Feria (?:II|Secunda)\b/iu, 'Segunda-feira')
    .replace(/^Feria (?:III|Tertia)\b/iu, 'Terça-feira')
    .replace(/^Feria (?:IV|Quarta)\b/iu, 'Quarta-feira')
    .replace(/^Feria (?:V|Quinta)\b/iu, 'Quinta-feira')
    .replace(/^Feria (?:VI|Sexta)\b/iu, 'Sexta-feira')
    .replace(/^Sabbato secunda\b/iu, 'Segundo sábado')
    .replace(/^Sabbato\b/iu, 'Sábado');

  if (translated === name) return undefined;

  return translated
    .replace(/infra Hebdomadam ([IVXLCDM]+) post Octavam Pentecostes/giu, 'da $1ª Semana depois da Oitava de Pentecostes')
    .replace(/infra Hebdomadam ([IVXLCDM]+) post Octavam Pasch(?:æ|ae)/giu, 'da $1ª Semana depois da Oitava da Páscoa')
    .replace(/infra Hebdomadam ([IVXLCDM]+) post Epiphaniam/giu, 'da $1ª Semana depois da Epifania')
    .replace(/infra Hebdomadam ([IVXLCDM]+) in Quadragesima/giu, 'da $1ª Semana da Quaresma')
    .replace(/infra Hebdomadam ([IVXLCDM]+) Adventus/giu, 'da $1ª Semana do Advento')
    .replace(/in Hebdomadam ([IVXLCDM]+) Adventus/giu, 'da $1ª Semana do Advento')
    .replace(/infra Hebdomadam Septuagesim(?:æ|ae)/giu, 'da Semana da Septuagésima')
    .replace(/infra Hebdomadam Sexagesim(?:æ|ae)/giu, 'da Semana da Sexagésima')
    .replace(/infra Hebdomadam Quinquagesim(?:æ|ae)/giu, 'da Semana da Quinquagésima')
    .replace(/infra Hebdomadam Passionis/giu, 'da Semana da Paixão')
    .replace(/infra Octavam Ascensionis/giu, 'na Oitava da Ascensão')
    .replace(/infra Octavam Corporis Christi/giu, 'na Oitava de Corpus Christi')
    .replace(/in Vigilia Pentecostes/giu, 'na Vigília de Pentecostes')
    .replace(/in Rogationibus/giu, 'das Rogações');
}

/** Translate the Latin rubrical rank used by fallback office files. */
export function translatePtRankName(rankName: string): string {
  return rankName
    .replace(/\bCommemoratio\b/giu, 'Comemoração')
    .replace(/\bSemiduplex\b/giu, 'Semiduplo')
    .replace(/\bDuplex\b/giu, 'Duplo')
    .replace(/\bSimplex\b/giu, 'Simples')
    .replace(/\bFeria\b/giu, 'Féria')
    .replace(/\bVigilia\b/giu, 'Vigília')
    .replace(/\bprivilegiata\b/giu, 'privilegiada')
    .replace(/\bmajor\b/giu, 'maior')
    .replace(/\bmajus\b/giu, 'maior')
    .replace(/\boptional\b/giu, 'opcional')
    .replace(/\b2nd class\b/giu, '2ª classe')
    .replace(/\b2 class(?:is)?\b/giu, '2ª classe')
    .replace(/\bclassis\b/giu, 'classe')
    .replace(/\bclass\b/giu, 'classe')
    .replace(/\bcum\b/giu, 'com')
    .replace(/\bOctava\b/giu, 'Oitava')
    .replace(/\boctava\b/giu, 'oitava')
    .replace(/\bcommuni\b/giu, 'comum')
    .replace(/\bsimplici\b/giu, 'simples')
    .replace(/\bordinis\b/giu, 'ordem');
}

/** Apply Portuguese translations to celebration names and commemorations. */
export function applyPtTranslations(
  days: CalendarDay[],
  translations: Record<string, string>,
): CalendarDay[] {
  const normalizedTranslations = new Map<string, string>();
  for (const [latin, portuguese] of Object.entries(translations)) {
    const key = normalizeLatinTranslationKey(latin);
    if (!normalizedTranslations.has(key)) normalizedTranslations.set(key, portuguese);
  }

  const translate = (name: string): string => {
    const withoutInPrefix = name.replace(/^In\s+/iu, '');
    return translations[name]
      ?? normalizedTranslations.get(normalizeLatinTranslationKey(name))
      ?? translations[withoutInPrefix]
      ?? normalizedTranslations.get(normalizeLatinTranslationKey(withoutInPrefix))
      ?? translatePtTemporalName(name)
      ?? translatePtOctaveName(name)
      ?? name;
  };

  return days.map((day) => ({
    ...day,
    celebration: {
      ...day.celebration,
      name: translate(day.celebration.name),
      rankName: translatePtRankName(day.celebration.rankName),
    },
    commemorations: day.commemorations.map(translate),
  }));
}

/** Apply exact-date Portuguese labels from an external calendar reference. */
export function applyPtDateTranslations(
  days: CalendarDay[],
  dateTranslations: Record<string, string>,
): CalendarDay[] {
  return days.map((day) => {
    const name = dateTranslations[day.date];
    if (!name || name === day.celebration.name) return day;
    return { ...day, celebration: { ...day.celebration, name } };
  });
}
