import {
  addMonths,
  dateTimeLabel,
  dayLabel,
  formatRupees,
  groupByDay,
  initials,
  monthBounds,
  monthLabel,
  timeLabel,
} from '../format';

describe('formatRupees', () => {
  test.each([
    [0, '₹0.00'],
    [5, '₹0.05'],
    [12000, '₹120.00'],
    [125050, '₹1,250.50'],
    [10000000, '₹1,00,000.00'],
    [123456789, '₹12,34,567.89'],
    [-8900, '−₹89.00'],
  ])('%d -> %s', (paise, text) => {
    expect(formatRupees(paise)).toBe(text);
  });

  test('can hide .00', () => {
    expect(formatRupees(12000, false)).toBe('₹120');
    expect(formatRupees(12050, false)).toBe('₹120.50');
  });
});

describe('months', () => {
  test('addMonths wraps years in both directions', () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(addMonths({ year: 2026, month: 5 }, -18)).toEqual({ year: 2024, month: 11 });
  });

  test('monthBounds covers exactly the month', () => {
    const { start, end } = monthBounds({ year: 2026, month: 1 });
    expect(new Date(start).getDate()).toBe(1);
    expect(Math.round((end - start) / 86400000)).toBe(28);
  });

  test('monthLabel', () => {
    expect(monthLabel({ year: 2026, month: 9 })).toBe('October 2026');
  });
});

describe('day and time labels', () => {
  const now = new Date(2026, 9, 29, 15, 0).getTime();

  test('Today / Yesterday / date', () => {
    expect(dayLabel(new Date(2026, 9, 29, 1, 0).getTime(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 28, 23, 0).getTime(), now)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 9, 26, 12, 0).getTime(), now)).toBe('Mon, 26 Oct');
  });

  test('timeLabel uses 12-hour time and hides midnight', () => {
    expect(timeLabel(new Date(2026, 9, 29, 21, 5).getTime())).toBe('9:05 pm');
    expect(timeLabel(new Date(2026, 9, 29, 0, 30).getTime())).toBe('12:30 am');
    expect(timeLabel(new Date(2026, 9, 29, 12, 0).getTime())).toBe('12:00 pm');
    expect(timeLabel(new Date(2026, 9, 29, 0, 0).getTime())).toBeNull();
  });

  test('dateTimeLabel', () => {
    expect(dateTimeLabel(new Date(2026, 9, 29, 21, 5).getTime())).toBe('29 Oct 2026, 9:05 pm');
    expect(dateTimeLabel(new Date(2026, 9, 27, 0, 0).getTime())).toBe('27 Oct 2026');
  });
});

describe('groupByDay', () => {
  const now = new Date(2026, 9, 29, 15, 0).getTime();
  const item = (day: number, hour: number, amountPaise: number, direction: string) => ({
    timestamp: new Date(2026, 9, day, hour).getTime(),
    amountPaise,
    direction,
  });

  test('groups consecutive days and totals money in minus out', () => {
    const sections = groupByDay(
      [item(29, 21, 12000, 'DEBIT'), item(29, 9, 1000, 'CREDIT'), item(27, 10, 6000, 'DEBIT')],
      now,
    );
    expect(sections.map(s => s.title)).toEqual(['Today', 'Tue, 27 Oct']);
    expect(sections[0].data).toHaveLength(2);
    expect(sections[0].totalPaise).toBe(-11000);
    expect(sections[1].totalPaise).toBe(-6000);
  });

  test('empty in, empty out', () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});

describe('initials', () => {
  test.each([
    ['Test Payee One', 'TP'],
    ['YouTube', 'Y'],
    ['  asha  rao ', 'AR'],
    ['', '?'],
    [null, '?'],
  ])('%s -> %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
