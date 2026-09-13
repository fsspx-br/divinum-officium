/**
 * Print-ready monthly calendar PDF inspired by the supplied priory calendar.
 *
 * The document intentionally contains only the date and liturgical columns.
 * Timed Masses and other custom events can be added later as a third column.
 */

import { jsPDF } from 'jspdf';
import type { CalendarDay, LiturgicalColor } from '@engine/types';
import { t, type Locale } from './i18n/i18n';
import { PRIORY_LOGO_DATA_URI } from './assets/priory-logo';

const DAYS_PER_WEEK_PAGE = 8;
const PAGE_MARGIN = 16;
const TABLE_TOP = 39;
const TABLE_BOTTOM = 282;
const DATE_COLUMN_WIDTH = 34;
const BACKGROUND_OPACITY = 0.3;

const LITURGICAL_COLORS: Record<LiturgicalColor, [number, number, number]> = {
  white: [255, 255, 255],
  red: [239, 68, 68],
  green: [34, 197, 94],
  violet: [139, 92, 246],
  rose: [244, 114, 182],
  black: [26, 26, 26],
};

export interface MonthlyCalendarPdfOptions {
  days: CalendarDay[];
  year: number;
  month: number;
  versionLabel: string;
  locale: Locale;
}

export interface MonthlyCalendarPdfDownloadOptions extends MonthlyCalendarPdfOptions {
  filename: string;
}

interface FittedContent {
  titleFontSize: number;
  titleLines: string[];
  commemorationFontSize: number;
  commemorationLines: string[];
  indicatorFontSize: number;
  indicatorLines: string[];
  totalHeight: number;
}

function splitLines(doc: jsPDF, text: string, width: number): string[] {
  if (!text) return [];
  return doc.splitTextToSize(text, width) as string[];
}

function lineHeight(fontSize: number): number {
  return fontSize * 0.352778 * 1.08;
}

function fittedSingleLineFontSize(
  doc: jsPDF,
  text: string,
  maximumWidth: number,
  initialSize: number,
  minimumSize: number,
): number {
  let fontSize = initialSize;
  doc.setFontSize(fontSize);
  while (fontSize > minimumSize && doc.getTextWidth(text) > maximumWidth) {
    fontSize -= 0.25;
    doc.setFontSize(fontSize);
  }
  return fontSize;
}

function localeIdentifier(locale: Locale): string {
  if (locale === 'pt') return 'pt-BR';
  if (locale === 'en') return 'en-US';
  return 'la';
}

function capitalise(text: string, locale: Locale): string {
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase(localeIdentifier(locale)) + text.slice(1);
}

function weekdayLabel(date: Date, locale: Locale): string {
  try {
    return capitalise(new Intl.DateTimeFormat(localeIdentifier(locale), {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(date), locale);
  } catch {
    return t(`days.${date.getUTCDay()}`);
  }
}

function dateForCalendarDay(calDay: CalendarDay): Date {
  const [year, month, day] = calDay.date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function monthDateLabel(date: Date, locale: Locale): string {
  const monthName = t(`months.${date.getUTCMonth() + 1}`);
  const abbreviation = monthName.slice(0, 3).toLocaleLowerCase(localeIdentifier(locale));
  return `${date.getUTCDate()}-${abbreviation}`;
}

function dayIndicators(calDay: CalendarDay): string[] {
  const indicators: string[] = [];
  if (calDay.holyDayOfObligation) indicators.push(t('holyDay.obligation'));
  if (calDay.abstinence) indicators.push(t('abstinence.day'));
  return indicators;
}

function fitDayContent(
  doc: jsPDF,
  calDay: CalendarDay,
  celebrationName: string,
  maximumWidth: number,
  maximumHeight: number,
): FittedContent {
  let titleFontSize = 12.5;
  let commemorationFontSize = 8;
  let indicatorFontSize = 6.5;
  const commemoration = calDay.commemorations.join('; ');
  const indicators = dayIndicators(calDay).join(' | ');

  let titleLines: string[] = [];
  let commemorationLines: string[] = [];
  let indicatorLines: string[] = [];
  let totalHeight = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    doc.setFont('times', 'bold');
    doc.setFontSize(titleFontSize);
    titleLines = splitLines(doc, celebrationName, maximumWidth);

    doc.setFont('times', 'italic');
    doc.setFontSize(commemorationFontSize);
    commemorationLines = splitLines(doc, commemoration, maximumWidth);

    doc.setFont('times', 'bold');
    doc.setFontSize(indicatorFontSize);
    indicatorLines = splitLines(doc, indicators, maximumWidth);

    const titleHeight = titleLines.length * lineHeight(titleFontSize);
    const commemorationHeight = commemorationLines.length * lineHeight(commemorationFontSize);
    const indicatorHeight = indicatorLines.length * lineHeight(indicatorFontSize);
    const titleGap = commemorationLines.length > 0 || indicatorLines.length > 0 ? 1.2 : 0;
    const commemorationGap = commemorationLines.length > 0 && indicatorLines.length > 0 ? 0.8 : 0;
    totalHeight = titleHeight + titleGap + commemorationHeight + commemorationGap + indicatorHeight;

    if (totalHeight <= maximumHeight) break;
    if (titleFontSize > 9) {
      titleFontSize -= 0.5;
    } else if (commemorationFontSize > 6.25) {
      commemorationFontSize -= 0.25;
    } else if (indicatorFontSize > 5.5) {
      indicatorFontSize -= 0.25;
    } else {
      break;
    }
  }

  return {
    titleFontSize,
    titleLines,
    commemorationFontSize,
    commemorationLines,
    indicatorFontSize,
    indicatorLines,
    totalHeight,
  };
}

function drawCenteredLines(
  doc: jsPDF,
  lines: string[],
  centerX: number,
  startY: number,
  fontSize: number,
): number {
  const height = lineHeight(fontSize);
  let baseline = startY + height * 0.78;
  for (const text of lines) {
    doc.text(text, centerX, baseline, { align: 'center' });
    baseline += height;
  }
  return startY + lines.length * height;
}

function drawHeader(
  doc: jsPDF,
): void {
  const centerX = doc.internal.pageSize.getWidth() / 2;

  doc.addImage(PRIORY_LOGO_DATA_URI, 'PNG', 28, 9.5, 6.3, 8);
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'normal');
  doc.setFontSize(14.5);
  doc.text('PRIORADO IMACULADO CORAÇÃO DE MARIA', centerX, 13.5, { align: 'center' });

  doc.setFontSize(15);
  doc.text(t('app.title').toLocaleUpperCase(), centerX, 20.5, { align: 'center' });
}

export function rankClassLabel(calDay: CalendarDay): string {
  if (calDay.celebration.rank >= 6) return '1ª Classe';
  if (calDay.celebration.rank >= 5 || calDay.isEmberDay) return '2ª Classe';
  if (calDay.celebration.rank >= 2) return '3ª Classe';
  return '4ª Classe';
}

export function liturgicalBackgroundColor(color: LiturgicalColor): [number, number, number] {
  return LITURGICAL_COLORS[color].map((channel) => (
    Math.round(255 * (1 - BACKGROUND_OPACITY) + channel * BACKGROUND_OPACITY)
  )) as [number, number, number];
}

/** Use the concise wording from the printed Portuguese calendar for an ordinary feria. */
export function pdfCelebrationName(calDay: CalendarDay, locale: Locale): string {
  const normalizedRank = calDay.celebration.rankName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLocaleLowerCase(localeIdentifier(locale));

  if (
    locale === 'pt'
    && calDay.celebration.source === 'temporal'
    && normalizedRank === 'feria'
  ) {
    return 'Da Féria';
  }

  return calDay.celebration.name;
}

function drawDayRow(
  doc: jsPDF,
  calDay: CalendarDay,
  locale: Locale,
  y: number,
  height: number,
): void {
  const tableWidth = doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2;
  const detailsX = PAGE_MARGIN + DATE_COLUMN_WIDTH;
  const detailsWidth = tableWidth - DATE_COLUMN_WIDTH;
  const date = dateForCalendarDay(calDay);
  const background = liturgicalBackgroundColor(calDay.color);

  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(...background);
  doc.setLineWidth(0.45);
  doc.rect(PAGE_MARGIN, y, tableWidth, height, 'FD');
  doc.line(detailsX, y, detailsX, y + height);

  const dateCenterX = PAGE_MARGIN + DATE_COLUMN_WIDTH / 2;
  const weekday = weekdayLabel(date, locale);
  doc.setFont('times', 'bold');
  const weekdayFontSize = fittedSingleLineFontSize(doc, weekday, DATE_COLUMN_WIDTH - 4, 9.5, 7);
  doc.setFontSize(weekdayFontSize);
  doc.text(weekday, dateCenterX, y + height * 0.43, { align: 'center' });
  doc.setFontSize(9);
  doc.text(monthDateLabel(date, locale), dateCenterX, y + height * 0.66, { align: 'center' });

  const metaY = y + 5;
  const rank = rankClassLabel(calDay);
  const color = t(`colors.${calDay.color}`);
  doc.setFont('times', 'bold');
  const rankFontSize = fittedSingleLineFontSize(doc, rank, detailsWidth * 0.63, 7.5, 6);
  doc.setFontSize(rankFontSize);
  doc.text(rank, detailsX + 5, metaY);
  const colorFontSize = fittedSingleLineFontSize(doc, color, detailsWidth * 0.25, 7.5, 6);
  doc.setFontSize(colorFontSize);
  doc.text(color, detailsX + detailsWidth - 5, metaY, { align: 'right' });

  const contentTop = y + 8;
  const contentBottom = y + height - 2;
  const celebrationName = pdfCelebrationName(calDay, locale);
  const fitted = fitDayContent(
    doc,
    calDay,
    celebrationName,
    detailsWidth - 10,
    contentBottom - contentTop,
  );
  let cursorY = contentTop + Math.max(0, (contentBottom - contentTop - fitted.totalHeight) / 2);
  const centerX = detailsX + detailsWidth / 2;

  doc.setFont('times', 'bold');
  doc.setFontSize(fitted.titleFontSize);
  cursorY = drawCenteredLines(doc, fitted.titleLines, centerX, cursorY, fitted.titleFontSize);

  if (fitted.commemorationLines.length > 0) {
    cursorY += 1.2;
    doc.setFont('times', 'italic');
    doc.setFontSize(fitted.commemorationFontSize);
    cursorY = drawCenteredLines(
      doc,
      fitted.commemorationLines,
      centerX,
      cursorY,
      fitted.commemorationFontSize,
    );
  }

  if (fitted.indicatorLines.length > 0) {
    if (fitted.commemorationLines.length > 0) cursorY += 0.8;
    else cursorY += 1.2;
    doc.setFont('times', 'bold');
    doc.setFontSize(fitted.indicatorFontSize);
    drawCenteredLines(doc, fitted.indicatorLines, centerX, cursorY, fitted.indicatorFontSize);
  }
}

function drawFooter(doc: jsPDF, pageNumber: number, pageCount: number): void {
  const centerX = doc.internal.pageSize.getWidth() / 2;
  doc.setFont('times', 'normal');
  doc.setFontSize(7);
  doc.text(`${pageNumber} / ${pageCount}`, centerX, 290, { align: 'center' });
}

export function daysForMonth(days: CalendarDay[], year: number, month: number): CalendarDay[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return days
    .filter((day) => day.date.startsWith(prefix))
    .sort((left, right) => left.date.localeCompare(right.date));
}

/** Build full Sunday-to-Sunday pages, repeating each boundary Sunday. */
export function calendarWeeksForMonth(
  days: CalendarDay[],
  year: number,
  month: number,
): CalendarDay[][] {
  const monthDays = daysForMonth(days, year, month);
  if (monthDays.length === 0) return [];

  const dayByDate = new Map(days.map((day) => [day.date, day]));
  const weeks: CalendarDay[][] = [];
  const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1, 12));
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0, 12));
  const firstSunday = new Date(firstDayOfMonth);
  firstSunday.setUTCDate(firstSunday.getUTCDate() - firstSunday.getUTCDay());
  const lastSunday = new Date(lastDayOfMonth);
  lastSunday.setUTCDate(lastSunday.getUTCDate() - lastSunday.getUTCDay());

  for (
    const weekStart = new Date(firstSunday);
    weekStart <= lastSunday;
    weekStart.setUTCDate(weekStart.getUTCDate() + 7)
  ) {
    const week: CalendarDay[] = [];
    for (let offset = 0; offset < DAYS_PER_WEEK_PAGE; offset += 1) {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + offset);
      const dateKey = date.toISOString().slice(0, 10);
      const calDay = dayByDate.get(dateKey);
      if (!calDay) {
        throw new Error(`Missing calendar data for weekly PDF date ${dateKey}`);
      }
      week.push(calDay);
    }
    weeks.push(week);
  }

  return weeks;
}

/** Build the selected month's PDF without starting a download. */
export function createMonthlyCalendarPdf(options: MonthlyCalendarPdfOptions): jsPDF {
  const monthDays = daysForMonth(options.days, options.year, options.month);
  if (monthDays.length === 0) {
    throw new Error(`No calendar data for ${options.year}-${String(options.month).padStart(2, '0')}`);
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
  });
  doc.setProperties({
    title: `${t('app.title')} - ${t(`months.${options.month}`)} ${options.year}`,
    subject: options.versionLabel,
    creator: 'Divinum Officium',
  });

  const calendarWeeks = calendarWeeksForMonth(
    options.days,
    options.year,
    options.month,
  );
  const pageCount = calendarWeeks.length;
  const rowHeight = (TABLE_BOTTOM - TABLE_TOP) / DAYS_PER_WEEK_PAGE;

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (pageIndex > 0) doc.addPage('a4', 'portrait');
    drawHeader(doc);

    const pageDays = calendarWeeks[pageIndex];
    pageDays.forEach((calDay, rowIndex) => {
      drawDayRow(
        doc,
        calDay,
        options.locale,
        TABLE_TOP + rowIndex * rowHeight,
        rowHeight,
      );
    });

    drawFooter(doc, pageIndex + 1, pageCount);
  }

  return doc;
}

/** Build and download the selected month's PDF in the browser. */
export function downloadMonthlyCalendarPdf(options: MonthlyCalendarPdfDownloadOptions): void {
  createMonthlyCalendarPdf(options).save(options.filename);
}
