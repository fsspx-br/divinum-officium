// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderAgenda } from '../src/ui/agenda-view';
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

describe('renderAgenda', () => {
  let container: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    setLocale('en');
    container = document.createElement('div');
  });

  it('renders month heading with year', () => {
    const days = [makeDay({ date: '2026-03-01' })];
    renderAgenda(container, days, 2026, 3);

    const heading = container.querySelector('h2');
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toContain('2026');
  });

  it('shows "no data" message when month has no days', () => {
    renderAgenda(container, [], 2026, 3);

    const msg = container.querySelector('.state-message');
    expect(msg).not.toBeNull();
  });

  it('filters days to the requested month only', () => {
    const days = [
      makeDay({ date: '2026-02-28' }),
      makeDay({ date: '2026-03-01' }),
      makeDay({ date: '2026-03-15' }),
      makeDay({ date: '2026-04-01' }),
    ];
    renderAgenda(container, days, 2026, 3);

    const rows = container.querySelectorAll('.agenda-row');
    expect(rows.length).toBe(2);
  });

  it('renders one row per day with correct data-date attribute', () => {
    const days = [
      makeDay({ date: '2026-03-01' }),
      makeDay({ date: '2026-03-02' }),
    ];
    renderAgenda(container, days, 2026, 3);

    const rows = container.querySelectorAll('.agenda-row');
    expect(rows.length).toBe(2);
    expect(rows[0].getAttribute('data-date')).toBe('2026-03-01');
    expect(rows[1].getAttribute('data-date')).toBe('2026-03-02');
  });

  it('marks Sundays with is-sunday class', () => {
    // 2026-03-01 is a Sunday
    const days = [makeDay({ date: '2026-03-01' })];
    renderAgenda(container, days, 2026, 3);

    const row = container.querySelector('.agenda-row');
    expect(row!.classList.contains('is-sunday')).toBe(true);
  });

  it('does not mark non-Sundays with is-sunday class', () => {
    // 2026-03-02 is a Monday
    const days = [makeDay({ date: '2026-03-02' })];
    renderAgenda(container, days, 2026, 3);

    const row = container.querySelector('.agenda-row');
    expect(row!.classList.contains('is-sunday')).toBe(false);
  });

  it('renders liturgical color bar with correct class', () => {
    const days = [makeDay({ date: '2026-03-01', color: 'red' })];
    renderAgenda(container, days, 2026, 3);

    const bar = container.querySelector('.agenda-color-bar');
    expect(bar).not.toBeNull();
    expect(bar!.classList.contains('color-red')).toBe(true);
  });

  it('displays celebration name', () => {
    const days = [makeDay({
      date: '2026-03-01',
      celebration: { name: 'In Annuntiatione B.M.V.', rank: 6, rankName: 'Duplex I classis', source: 'sanctoral' },
    })];
    renderAgenda(container, days, 2026, 3);

    const name = container.querySelector('.agenda-celebration-name');
    expect(name!.textContent).toContain('In Annuntiatione B.M.V.');
  });

  it('displays rank, season, and color in meta line', () => {
    const days = [makeDay({
      date: '2026-03-01',
      celebration: { name: 'Test', rank: 3, rankName: 'Duplex', source: 'temporal' },
      season: 'lent',
      color: 'violet',
    })];
    renderAgenda(container, days, 2026, 3);

    const rank = container.querySelector('.agenda-rank');
    expect(rank!.textContent).toBe('Duplex');

    const season = container.querySelector('.agenda-season');
    expect(season!.textContent).toBe('Lent');
  });

  it('renders commemorations when present', () => {
    const days = [makeDay({
      date: '2026-03-01',
      commemorations: ['S. David', 'S. Albinus'],
    })];
    renderAgenda(container, days, 2026, 3);

    const comms = container.querySelector('.agenda-commemorations');
    expect(comms).not.toBeNull();
    expect(comms!.textContent).toContain('S. David');
    expect(comms!.textContent).toContain('S. Albinus');
  });

  it('does not render commemorations section when empty', () => {
    const days = [makeDay({ date: '2026-03-01', commemorations: [] })];
    renderAgenda(container, days, 2026, 3);

    const comms = container.querySelector('.agenda-commemorations');
    expect(comms).toBeNull();
  });

  it('shows church emoji for holy days of obligation', () => {
    const days = [makeDay({ date: '2026-03-01', holyDayOfObligation: true })];
    renderAgenda(container, days, 2026, 3);

    const icon = container.querySelector('.holy-day-icon');
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe('\u26EA');
  });

  it('does not show church emoji when not a holy day', () => {
    const days = [makeDay({ date: '2026-03-01', holyDayOfObligation: false })];
    renderAgenda(container, days, 2026, 3);

    const icon = container.querySelector('.holy-day-icon');
    expect(icon).toBeNull();
  });

  it('shows fish emoji for abstinence days', () => {
    const days = [makeDay({ date: '2026-03-01', abstinence: true })];
    renderAgenda(container, days, 2026, 3);

    const icon = container.querySelector('.abstinence-icon');
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe('\uD83D\uDC1F');
  });

  it('does not show fish emoji when not an abstinence day', () => {
    const days = [makeDay({ date: '2026-03-01', abstinence: false })];
    renderAgenda(container, days, 2026, 3);

    const icon = container.querySelector('.abstinence-icon');
    expect(icon).toBeNull();
  });

  it('clears container before rendering', () => {
    container.innerHTML = '<p>old content</p>';
    const days = [makeDay({ date: '2026-03-01' })];
    renderAgenda(container, days, 2026, 3);

    expect(container.querySelector('p.old')).toBeNull();
    expect(container.querySelector('.agenda-list')).not.toBeNull();
  });

  it('renders day number in the date block', () => {
    const days = [makeDay({ date: '2026-03-15' })];
    renderAgenda(container, days, 2026, 3);

    const dayNum = container.querySelector('.agenda-day-num');
    expect(dayNum!.textContent).toBe('15');
  });
});
