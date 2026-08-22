// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderGrid } from '../src/ui/grid-view';
import { setLocale } from '../src/ui/i18n/i18n';
import type { CalendarDay } from '../src/engine/types';

function makeDay(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: '2026-03-01',
    season: 'lent',
    weekRef: 'Hebd. I in Quadragesima',
    celebration: {
      name: 'Feria II',
      rank: 1,
      rankName: 'Feria',
      source: 'temporal',
    },
    color: 'violet',
    commemorations: [],
    ...overrides,
  };
}

function makeMarchDays(): CalendarDay[] {
  const days: CalendarDay[] = [];
  for (let d = 1; d <= 31; d++) {
    const dd = String(d).padStart(2, '0');
    days.push(makeDay({ date: `2026-03-${dd}` }));
  }
  return days;
}

describe('renderGrid', () => {
  let container: HTMLElement;
  const noopMonthChange = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    setLocale('en');
    container = document.createElement('div');
    noopMonthChange.mockClear();
  });

  it('renders month heading with year', () => {
    renderGrid(container, makeMarchDays(), 2026, 3, noopMonthChange);

    const heading = container.querySelector('h2');
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toContain('2026');
  });

  it('renders prev and next navigation buttons', () => {
    renderGrid(container, makeMarchDays(), 2026, 3, noopMonthChange);

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
  });

  it('calls onMonthChange with previous month when prev clicked', () => {
    renderGrid(container, makeMarchDays(), 2026, 3, noopMonthChange);

    const prevBtn = container.querySelector('button[aria-label="Previous month"]') as HTMLButtonElement;
    prevBtn.click();

    expect(noopMonthChange).toHaveBeenCalledWith(2026, 2);
  });

  it('calls onMonthChange with next month when next clicked', () => {
    renderGrid(container, makeMarchDays(), 2026, 3, noopMonthChange);

    const nextBtn = container.querySelector('button[aria-label="Next month"]') as HTMLButtonElement;
    nextBtn.click();

    expect(noopMonthChange).toHaveBeenCalledWith(2026, 4);
  });

  it('wraps from January to previous December', () => {
    const janDays = [makeDay({ date: '2026-01-01' })];
    renderGrid(container, janDays, 2026, 1, noopMonthChange);

    const prevBtn = container.querySelector('button[aria-label="Previous month"]') as HTMLButtonElement;
    prevBtn.click();

    expect(noopMonthChange).toHaveBeenCalledWith(2025, 12);
  });

  it('wraps from December to next January', () => {
    const decDays = [makeDay({ date: '2026-12-01' })];
    renderGrid(container, decDays, 2026, 12, noopMonthChange);

    const nextBtn = container.querySelector('button[aria-label="Next month"]') as HTMLButtonElement;
    nextBtn.click();

    expect(noopMonthChange).toHaveBeenCalledWith(2027, 1);
  });

  it('renders a 7-column table header (Sun–Sat)', () => {
    renderGrid(container, makeMarchDays(), 2026, 3, noopMonthChange);

    const thElements = container.querySelectorAll('thead th');
    expect(thElements.length).toBe(7);
  });

  it('renders correct number of day cells for the month', () => {
    renderGrid(container, makeMarchDays(), 2026, 3, noopMonthChange);

    const dayCells = container.querySelectorAll('td:not(.empty) .day-number');
    expect(dayCells.length).toBe(31);
  });

  it('fills leading empty cells for months not starting on Sunday', () => {
    // March 2026 starts on Sunday, so no leading empty cells
    renderGrid(container, makeMarchDays(), 2026, 3, noopMonthChange);
    const firstRow = container.querySelector('tbody tr');
    const emptyCells = firstRow!.querySelectorAll('td.empty');
    expect(emptyCells.length).toBe(0);

    // April 2026 starts on Wednesday (dow=3), so 3 leading empty cells
    const aprilDays: CalendarDay[] = [];
    for (let d = 1; d <= 30; d++) {
      const dd = String(d).padStart(2, '0');
      aprilDays.push(makeDay({ date: `2026-04-${dd}` }));
    }
    const container2 = document.createElement('div');
    renderGrid(container2, aprilDays, 2026, 4, noopMonthChange);
    const firstRow2 = container2.querySelector('tbody tr');
    const emptyCells2 = firstRow2!.querySelectorAll('td.empty');
    expect(emptyCells2.length).toBe(3);
  });

  it('fills trailing empty cells on the last row', () => {
    renderGrid(container, makeMarchDays(), 2026, 3, noopMonthChange);

    const rows = container.querySelectorAll('tbody tr');
    const lastRow = rows[rows.length - 1];
    const cells = lastRow.querySelectorAll('td');
    expect(cells.length).toBe(7);
  });

  it('marks Sundays with is-sunday class', () => {
    // March 2026: 1st is Sunday
    renderGrid(container, makeMarchDays(), 2026, 3, noopMonthChange);

    const firstDayCell = container.querySelector('td:not(.empty)');
    expect(firstDayCell!.classList.contains('is-sunday')).toBe(true);
  });

  it('renders celebration badge with color class', () => {
    const days = [makeDay({
      date: '2026-03-01',
      color: 'red',
      celebration: { name: 'Test Feast', rank: 4, rankName: 'Duplex majus', source: 'sanctoral' },
    })];
    renderGrid(container, days, 2026, 3, noopMonthChange);

    const badge = container.querySelector('.celebration-badge');
    expect(badge).not.toBeNull();
    expect(badge!.classList.contains('color-red')).toBe(true);
    expect(badge!.textContent).toBe('Test Feast');
  });

  it('shows church emoji for holy days of obligation', () => {
    const days = [makeDay({ date: '2026-03-01', holyDayOfObligation: true })];
    renderGrid(container, days, 2026, 3, noopMonthChange);

    const icon = container.querySelector('.holy-day-icon');
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe('\u26EA');
  });

  it('shows fish emoji for abstinence days', () => {
    const days = [makeDay({ date: '2026-03-01', abstinence: true })];
    renderGrid(container, days, 2026, 3, noopMonthChange);

    const icon = container.querySelector('.abstinence-icon');
    expect(icon).not.toBeNull();
  });

  it('places day icons in the calendar cell for bottom-right positioning', () => {
    const days = [makeDay({
      date: '2026-03-01',
      holyDayOfObligation: true,
      abstinence: true,
    })];
    renderGrid(container, days, 2026, 3, noopMonthChange);

    const cell = container.querySelector('td:not(.empty)');
    const icons = cell?.querySelector(':scope > .day-icons');
    expect(cell?.classList.contains('has-day-icons')).toBe(true);
    expect(icons).not.toBeNull();
    expect(icons?.children).toHaveLength(2);
  });

  it('does not show icons when flags are not set', () => {
    const days = [makeDay({ date: '2026-03-01' })];
    renderGrid(container, days, 2026, 3, noopMonthChange);

    expect(container.querySelector('.holy-day-icon')).toBeNull();
    expect(container.querySelector('.abstinence-icon')).toBeNull();
  });

  it('clears container before rendering', () => {
    container.innerHTML = '<p>old content</p>';
    renderGrid(container, makeMarchDays(), 2026, 3, noopMonthChange);

    expect(container.innerHTML).not.toContain('old content');
    expect(container.querySelector('.calendar-table')).not.toBeNull();
  });

  it('renders day numbers sequentially', () => {
    renderGrid(container, makeMarchDays(), 2026, 3, noopMonthChange);

    const dayNumbers = container.querySelectorAll('.day-number');
    expect(dayNumbers[0].textContent).toBe('1');
    expect(dayNumbers[dayNumbers.length - 1].textContent).toBe('31');
  });

  it('handles months with no matching calendar data gracefully', () => {
    renderGrid(container, [], 2026, 3, noopMonthChange);

    // Should still render the grid structure, just without badges
    const table = container.querySelector('.calendar-table');
    expect(table).not.toBeNull();
    const dayNumbers = container.querySelectorAll('.day-number');
    expect(dayNumbers.length).toBe(31);
  });
});
