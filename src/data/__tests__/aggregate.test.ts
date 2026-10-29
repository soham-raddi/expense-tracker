import { fillMonths, groupBreakdown, monthlyTotals, totalsOf, type LiteTxn } from '../aggregate';

const at = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime();
const txn = (timestamp: number, amountPaise: number, direction: 'DEBIT' | 'CREDIT', excluded = false): LiteTxn => ({
  timestamp,
  amountPaise,
  direction,
  excluded,
});

describe('totalsOf', () => {
  test('sums spent and received and skips excluded payments', () => {
    const t = totalsOf([
      txn(0, 12000, 'DEBIT'),
      txn(0, 5000, 'DEBIT'),
      txn(0, 1000, 'CREDIT'),
      txn(0, 999999, 'DEBIT', true),
      txn(0, 888888, 'CREDIT', true),
    ]);
    expect(t).toEqual({ spentPaise: 17000, receivedPaise: 1000, count: 3 });
  });

  test('empty is all zero', () => {
    expect(totalsOf([])).toEqual({ spentPaise: 0, receivedPaise: 0, count: 0 });
  });
});

describe('monthlyTotals', () => {
  test('groups by calendar month, newest first, only months with data', () => {
    const result = monthlyTotals([
      txn(at(2026, 9, 29), 4500, 'DEBIT'),
      txn(at(2026, 9, 2), 1000, 'CREDIT'),
      txn(at(2026, 7, 15), 7000, 'DEBIT'),
      txn(at(2026, 9, 28), 100, 'DEBIT', true),
    ]);
    expect(result.map(r => r.month)).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 7 },
    ]);
    expect(result[0]).toMatchObject({ spentPaise: 4500, receivedPaise: 1000, count: 2 });
    expect(result[1]).toMatchObject({ spentPaise: 7000, receivedPaise: 0, count: 1 });
  });

  test('the first and last instant of a month land in that month', () => {
    const result = monthlyTotals([
      txn(new Date(2026, 9, 1, 0, 0, 0).getTime(), 100, 'DEBIT'),
      txn(new Date(2026, 9, 31, 23, 59, 59).getTime(), 200, 'DEBIT'),
      txn(new Date(2026, 10, 1, 0, 0, 0).getTime(), 400, 'DEBIT'),
    ]);
    expect(result.map(r => r.spentPaise)).toEqual([400, 300]);
  });
});

describe('fillMonths', () => {
  test('returns exactly N months oldest to newest, zero-filled', () => {
    const totals = monthlyTotals([txn(at(2026, 9, 3), 500, 'DEBIT')]);
    const six = fillMonths(totals, { year: 2026, month: 9 }, 6);
    expect(six).toHaveLength(6);
    expect(six[0].month).toEqual({ year: 2026, month: 4 });
    expect(six[5]).toMatchObject({ month: { year: 2026, month: 9 }, spentPaise: 500 });
    expect(six[2].spentPaise).toBe(0);
  });
});

describe('groupBreakdown', () => {
  const row = (amountPaise: number, categoryId: number | null, name: string | null, over = {}) => ({
    amountPaise,
    direction: 'DEBIT',
    excluded: false,
    categoryId,
    categoryName: name,
    categoryColour: name ? '#123456' : null,
    ...over,
  });

  test('sums spending per group, biggest first, with shares', () => {
    const slices = groupBreakdown([
      row(30000, 1, 'Food & Dining'),
      row(10000, 1, 'Food & Dining'),
      row(60000, 2, 'Shopping'),
      row(10000, null, null),
    ]);
    expect(slices.map(s => s.name)).toEqual(['Shopping', 'Food & Dining', 'Uncategorized']);
    expect(slices[1]).toMatchObject({ spentPaise: 40000, count: 2 });
    expect(slices[0].share).toBeCloseTo(60000 / 110000);
    expect(slices.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
  });

  test('ignores credits and excluded groups', () => {
    const slices = groupBreakdown([
      row(5000, 1, 'Food & Dining'),
      row(9000, 3, 'Income', { direction: 'CREDIT' }),
      row(7000, 4, 'Transfers (self)', { excluded: true }),
    ]);
    expect(slices).toHaveLength(1);
    expect(slices[0].share).toBe(1);
  });

  test('no spending gives no slices', () => {
    expect(groupBreakdown([])).toEqual([]);
  });
});
