/**
 * agenda-view.ts — Monthly agenda list renderer
 *
 * Renders a vertical list of days for the given month, each showing:
 *   - Date block (day-of-week abbreviation + day number)
 *   - Vertical liturgical color bar
 *   - Celebration details: name, rank, season, color label
 *   - Commemorations (if any)
 */

import type { CalendarDay } from '@engine/types';
import { t } from './i18n/i18n';

/**
 * Capitalise the first letter of a string.
 */
function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Zero-pad a number to 2 digits.
 */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Render the agenda list for the given month into `container`.
 *
 * @param container - The DOM element to render into
 * @param days      - Full year's CalendarDay array
 * @param year      - The currently displayed year
 * @param month     - The currently displayed month (1-based)
 */
export function renderAgenda(
  container: HTMLElement,
  days: CalendarDay[],
  year: number,
  month: number,
): void {
  container.innerHTML = '';

  // ── Month heading ──────────────────────────────────────────────
  const nav = document.createElement('div');
  nav.className = 'month-nav';
  const heading = document.createElement('h2');
  heading.textContent = `${t(`months.${month}`)} ${year}`;
  nav.appendChild(heading);
  container.appendChild(nav);

  // ── Filter to this month ───────────────────────────────────────
  const prefix = `${year}-${pad2(month)}-`;
  const monthDays = days.filter((d) => d.date.startsWith(prefix));

  if (monthDays.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'state-message';
    msg.textContent = t('states.noData');
    container.appendChild(msg);
    return;
  }

  // ── Agenda list ────────────────────────────────────────────────
  const list = document.createElement('div');
  list.className = 'agenda-list';

  for (const calDay of monthDays) {
    const dateObj = new Date(calDay.date + 'T00:00:00'); // local noon to avoid DST issues
    const dow = t(`days.${dateObj.getDay()}`);
    const dayNum = dateObj.getDate();
    const isSunday = dateObj.getDay() === 0;

    // Row container
    const row = document.createElement('div');
    row.className = `agenda-row${isSunday ? ' is-sunday' : ''}`;
    row.setAttribute('data-date', calDay.date);

    // 1. Date block
    const dateBlock = document.createElement('div');
    dateBlock.className = 'agenda-date';

    const dowEl = document.createElement('span');
    dowEl.className = 'agenda-dow';
    dowEl.textContent = dow;

    const dayNumEl = document.createElement('span');
    dayNumEl.className = 'agenda-day-num';
    dayNumEl.textContent = String(dayNum);

    dateBlock.appendChild(dowEl);
    dateBlock.appendChild(dayNumEl);

    // 2. Color bar
    const colorBar = document.createElement('div');
    colorBar.className = `agenda-color-bar color-${calDay.color}`;
    colorBar.setAttribute('aria-label', `${calDay.color} vestments`);

    // 3. Details
    const details = document.createElement('div');
    details.className = 'agenda-details';

    // Celebration name
    const celebName = document.createElement('div');
    celebName.className = 'agenda-celebration-name';
    if (calDay.holyDayOfObligation) {
      const holyIcon = document.createElement('span');
      holyIcon.className = 'holy-day-icon';
      holyIcon.textContent = '\u26EA';
      holyIcon.title = t('holyDay.obligation');
      celebName.appendChild(holyIcon);
    }
    const nameText = document.createTextNode(calDay.celebration.name);
    celebName.appendChild(nameText);
    celebName.title = calDay.celebration.name;

    // Meta line: rank · season · color
    const meta = document.createElement('div');
    meta.className = 'agenda-meta';

    const rankEl = document.createElement('span');
    rankEl.className = 'agenda-rank';
    rankEl.textContent = calDay.celebration.rankName;

    const sep1 = document.createElement('span');
    sep1.textContent = '\u00b7';
    sep1.setAttribute('aria-hidden', 'true');

    const seasonEl = document.createElement('span');
    seasonEl.className = 'agenda-season';
    seasonEl.textContent = capitalize(calDay.season.replace(/-/g, ' '));

    const sep2 = document.createElement('span');
    sep2.textContent = '\u00b7';
    sep2.setAttribute('aria-hidden', 'true');

    const colorLabel = document.createElement('span');
    colorLabel.className = 'agenda-color-label';
    colorLabel.textContent = t(`colors.${calDay.color}`);

    meta.appendChild(rankEl);
    meta.appendChild(sep1);
    meta.appendChild(seasonEl);
    meta.appendChild(sep2);
    meta.appendChild(colorLabel);

    details.appendChild(celebName);
    details.appendChild(meta);

    // Commemorations
    if (calDay.commemorations.length > 0) {
      const comms = document.createElement('div');
      comms.className = 'agenda-commemorations';
      comms.title = calDay.commemorations.join('; ');
      comms.textContent = t('agenda.also') + ' ' + calDay.commemorations.join(', ');
      details.appendChild(comms);
    }

    // Assemble row
    row.appendChild(dateBlock);
    row.appendChild(colorBar);
    row.appendChild(details);

    list.appendChild(row);
  }

  container.appendChild(list);
}
