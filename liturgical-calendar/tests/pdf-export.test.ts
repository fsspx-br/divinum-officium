// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { CalendarDay } from '../src/engine/types';
import {
  calendarWeeksForMonth,
  createMonthlyCalendarPdf,
  daysForMonth,
  liturgicalBackgroundColor,
  pdfCelebrationName,
  rankClassLabel,
} from '../src/ui/pdf-export';
import { setLocale } from '../src/ui/i18n/i18n';

function makeDay(date: string, overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date,
    season: 'pentecost',
    weekRef: 'Pent16',
    celebration: {
      name: 'Féria da Semana depois de Pentecostes',
      rank: 1,
      rankName: 'Féria',
      source: 'temporal',
    },
    color: 'green',
    commemorations: [],
    ...overrides,
  };
}

function makeDateRange(start: string, end: string): CalendarDay[] {
  const days: CalendarDay[] = [];
  const date = new Date(`${start}T12:00:00Z`);
  const lastDate = new Date(`${end}T12:00:00Z`);
  while (date <= lastDate) {
    days.push(makeDay(date.toISOString().slice(0, 10)));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
}

describe('monthly calendar PDF', () => {
  beforeEach(() => setLocale('pt'));

  it('filters and sorts only the requested month', () => {
    const days = [
      makeDay('2026-10-02'),
      makeDay('2026-09-30'),
      makeDay('2026-10-01'),
      makeDay('2026-11-01'),
    ];

    expect(daysForMonth(days, 2026, 10).map((day) => day.date))
      .toEqual(['2026-10-01', '2026-10-02']);
  });

  it('prints complete Sunday-to-Sunday weeks, including adjacent months', () => {
    const days = makeDateRange('2026-08-30', '2026-10-04');

    const doc = createMonthlyCalendarPdf({
      days,
      year: 2026,
      month: 9,
      versionLabel: 'Rubrics 1960 - 1960',
      locale: 'pt',
    });

    expect(calendarWeeksForMonth(days, 2026, 9).map((week) => week.map((day) => day.date)))
      .toEqual([
        ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'],
        ['2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'],
        ['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'],
        ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'],
        ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
      ]);
    expect(doc.getNumberOfPages()).toBe(5);
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(1_000);
  });

  it('prints an ordinary Portuguese temporal day as Da Féria', () => {
    expect(pdfCelebrationName(makeDay('2026-09-17'), 'pt')).toBe('Da Féria');
    expect(pdfCelebrationName(makeDay('2026-09-18', {
      celebration: {
        name: 'Sexta-feira das Têmporas de Setembro',
        rank: 4.9,
        rankName: 'Féria maior',
        source: 'temporal',
      },
      isEmberDay: true,
    }), 'pt')).toBe('Sexta-feira das Têmporas de Setembro');
  });

  it('rejects a month without calendar data', () => {
    expect(() => createMonthlyCalendarPdf({
      days: [makeDay('2026-09-01')],
      year: 2026,
      month: 10,
      versionLabel: 'Rubrics 1960 - 1960',
      locale: 'pt',
    })).toThrow('No calendar data for 2026-10');
  });

  it('normalises historical ranks to the four classes', () => {
    expect(rankClassLabel(makeDay('2026-09-01'))).toBe('4ª Classe');
    expect(rankClassLabel(makeDay('2026-09-02', {
      celebration: { name: 'Duplo', rank: 3, rankName: 'Duplo', source: 'sanctoral' },
    }))).toBe('3ª Classe');
    expect(rankClassLabel(makeDay('2026-09-03', {
      celebration: { name: 'Festa', rank: 5, rankName: 'Duplo II classe', source: 'sanctoral' },
    }))).toBe('2ª Classe');
    expect(rankClassLabel(makeDay('2026-09-04', {
      celebration: { name: 'Festa', rank: 6, rankName: 'Duplo I classe', source: 'sanctoral' },
    }))).toBe('1ª Classe');
    expect(rankClassLabel(makeDay('2026-09-05', {
      celebration: { name: 'Têmporas', rank: 4.9, rankName: 'Féria maior', source: 'temporal' },
      isEmberDay: true,
    }))).toBe('2ª Classe');
  });

  it('blends liturgical colors over white at thirty percent opacity', () => {
    expect(liturgicalBackgroundColor('white')).toEqual([255, 255, 255]);
    expect(liturgicalBackgroundColor('red')).toEqual([250, 199, 199]);
    expect(liturgicalBackgroundColor('green')).toEqual([189, 238, 207]);
    expect(liturgicalBackgroundColor('black')).toEqual([186, 186, 186]);
  });
});
