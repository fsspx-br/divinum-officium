/**
 * grid-view.ts — Monthly calendar grid renderer
 *
 * Renders a 7-column (Sun–Sat) month table with liturgical color badges,
 * plus prev/next month navigation.
 */

import type { CalendarDay } from '@engine/types';
import { t } from './i18n/i18n';

/**
 * Build a lookup map: ISO date string → CalendarDay
 */
function buildDayMap(days: CalendarDay[]): Map<string, CalendarDay> {
  const map = new Map<string, CalendarDay>();
  for (const day of days) {
    map.set(day.date, day);
  }
  return map;
}

/**
 * Zero-pad a number to 2 digits.
 */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Render the monthly calendar grid into `container`.
 *
 * @param container      - The DOM element to render into
 * @param days           - Full year's CalendarDay array
 * @param year           - The currently displayed year
 * @param month          - The currently displayed month (1-based)
 * @param onMonthChange  - Callback invoked with new (year, month) when user navigates
 */
export function renderGrid(
  container: HTMLElement,
  days: CalendarDay[],
  year: number,
  month: number,
  onMonthChange: (year: number, month: number) => void,
): void {
  container.innerHTML = '';

  const dayMap = buildDayMap(days);

  // ── Month Navigation ───────────────────────────────────────────
  const nav = document.createElement('div');
  nav.className = 'month-nav';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = t('nav.prev');
  prevBtn.setAttribute('aria-label', 'Previous month');
  prevBtn.addEventListener('click', () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    onMonthChange(newYear, newMonth);
  });

  const heading = document.createElement('h2');
  heading.textContent = `${t(`months.${month}`)} ${year}`;

  const nextBtn = document.createElement('button');
  nextBtn.textContent = t('nav.next');
  nextBtn.setAttribute('aria-label', 'Next month');
  nextBtn.addEventListener('click', () => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    onMonthChange(newYear, newMonth);
  });

  nav.appendChild(prevBtn);
  nav.appendChild(heading);
  nav.appendChild(nextBtn);
  container.appendChild(nav);

  // ── Table ──────────────────────────────────────────────────────
  const table = document.createElement('table');
  table.className = 'calendar-table';

  // Header row: Sun–Sat
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (let d = 0; d < 7; d++) {
    const th = document.createElement('th');
    th.textContent = t(`days.${d}`);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Determine first day of month and total days in month
  const firstDate = new Date(year, month - 1, 1);
  const startDow = firstDate.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate();

  const tbody = document.createElement('tbody');

  let dayOfMonth = 1;
  let rowOpen = false;
  let currentRow: HTMLTableRowElement | null = null;
  let cellCount = 0;

  // We build rows manually to control exactly when a new row starts
  while (dayOfMonth <= daysInMonth) {
    if (!rowOpen) {
      currentRow = document.createElement('tr');
      rowOpen = true;
      cellCount = 0;

      // Fill leading empty cells on the first row
      if (dayOfMonth === 1 && startDow > 0) {
        for (let e = 0; e < startDow; e++) {
          const emptyTd = document.createElement('td');
          emptyTd.className = 'empty';
          currentRow.appendChild(emptyTd);
          cellCount++;
        }
      }
    }

    // Build date string for map lookup
    const isoDate = `${year}-${pad2(month)}-${pad2(dayOfMonth)}`;
    const calDay = dayMap.get(isoDate);

    const td = document.createElement('td');

    // Determine day-of-week for this cell
    const thisDow = (startDow + dayOfMonth - 1) % 7;
    if (thisDow === 0) {
      td.classList.add('is-sunday');
    }

    // Day number + holy day indicator
    const dayHeader = document.createElement('div');
    dayHeader.className = 'day-header';

    const dayNum = document.createElement('span');
    dayNum.className = 'day-number';
    dayNum.textContent = String(dayOfMonth);
    dayHeader.appendChild(dayNum);

    const icons = document.createElement('span');
    icons.className = 'day-icons';

    if (calDay?.holyDayOfObligation) {
      const holyIcon = document.createElement('span');
      holyIcon.className = 'holy-day-icon';
      holyIcon.textContent = '\u26EA';
      holyIcon.title = t('holyDay.obligation');
      icons.appendChild(holyIcon);
    }

    if (calDay?.abstinence) {
      const fishIcon = document.createElement('span');
      fishIcon.className = 'abstinence-icon';
      fishIcon.textContent = '\uD83D\uDC1F';
      fishIcon.title = t('abstinence.day');
      icons.appendChild(fishIcon);
    }

    if (icons.childElementCount > 0) {
      dayHeader.appendChild(icons);
    }

    td.appendChild(dayHeader);

    // Celebration badge
    if (calDay) {
      const badge = document.createElement('span');
      badge.className = `celebration-badge color-${calDay.color}`;
      badge.textContent = calDay.celebration.name;
      badge.title = calDay.celebration.name; // full name on hover
      td.appendChild(badge);
    }

    currentRow!.appendChild(td);
    cellCount++;
    dayOfMonth++;

    // Close row at end of week or end of month
    if (cellCount === 7 || dayOfMonth > daysInMonth) {
      // Fill trailing empty cells on the last row
      if (dayOfMonth > daysInMonth && cellCount < 7) {
        for (let t = cellCount; t < 7; t++) {
          const emptyTd = document.createElement('td');
          emptyTd.className = 'empty';
          currentRow!.appendChild(emptyTd);
        }
      }
      tbody.appendChild(currentRow!);
      rowOpen = false;
    }
  }

  table.appendChild(tbody);
  container.appendChild(table);
}
