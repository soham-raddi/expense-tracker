import {
  applyFilters,
  isAmountSort,
  isDefault,
  narrowingCount,
  NO_FILTERS,
  parseRupeesInput,
  type FilterableTxn,
  type TxnFilters,
} from '../txnFilter';

const t = (over: Partial<FilterableTxn>): FilterableTxn => ({
  amountPaise: 10000,
  direction: 'DEBIT',
  timestamp: 1000,
  mode: 'UPI',
  categoryId: 1,
  categoryName: 'Food & Dining',
  payeeName: 'Test Payee',
  payeeOriginalName: 'TEST PAYEE',
  note: null,
  ...over,
});

const rows: FilterableTxn[] = [
  t({ amountPaise: 12000, timestamp: 5, payeeName: 'Dominos', categoryId: 1 }),
  t({ amountPaise: 250000, timestamp: 4, payeeName: 'Rent Owner', categoryId: 2, categoryName: 'Rent', mode: 'NEFT' }),
  t({ amountPaise: 2000000, timestamp: 3, direction: 'CREDIT', categoryId: 3, categoryName: 'Income', mode: 'OTHER', payeeName: 'Employer' }),
  t({ amountPaise: 50000, timestamp: 2, direction: 'CREDIT', categoryId: 4, categoryName: 'Friends', payeeName: 'Priya', payeeOriginalName: 'TEST FATHER NAME', note: 'dinner split' }),
  t({ amountPaise: 99900, timestamp: 1, categoryId: null, categoryName: null, mode: 'CARD', payeeName: 'MIN*Retail' }),
];

const with_ = (f: Partial<TxnFilters>): TxnFilters => ({ ...NO_FILTERS, ...f });
const names = (f: Partial<TxnFilters>) => applyFilters(rows, with_(f)).map(r => r.payeeName);

describe('parseRupeesInput', () => {
  test.each([
    ['1000', 100000],
    ['1,000', 100000],
    ['₹ 1,000.50', 100050],
    ['0.5', 50],
  ])('%s -> %d', (input, paise) => {
    expect(parseRupeesInput(input)).toBe(paise);
  });

  test.each(['', 'abc', '12.345', '-5'])('rejects %p', input => {
    expect(parseRupeesInput(input)).toBeNull();
  });
});

describe('applyFilters', () => {
  test('no filters: everything, newest first', () => {
    expect(names({})).toEqual(['Dominos', 'Rent Owner', 'Employer', 'Priya', 'MIN*Retail']);
  });

  test('only income-type payments: money received', () => {
    expect(names({ direction: 'CREDIT' })).toEqual(['Employer', 'Priya']);
  });

  test('only money spent', () => {
    expect(names({ direction: 'DEBIT' })).toEqual(['Dominos', 'Rent Owner', 'MIN*Retail']);
  });

  test('purchases above ₹1,000', () => {
    expect(names({ direction: 'DEBIT', minPaise: 100000 })).toEqual(['Rent Owner']);
  });

  test('an amount range is inclusive at both ends', () => {
    expect(names({ minPaise: 50000, maxPaise: 99900 })).toEqual(['Priya', 'MIN*Retail']);
  });

  test('by group, including payments with no group', () => {
    expect(names({ group: { id: 1 } })).toEqual(['Dominos']);
    expect(names({ group: { id: null } })).toEqual(['MIN*Retail']);
  });

  test('by type of payment', () => {
    expect(names({ mode: 'NEFT' })).toEqual(['Rent Owner']);
    expect(names({ mode: 'CARD' })).toEqual(['MIN*Retail']);
  });

  test('search finds your name, the bank name, the note and the group', () => {
    expect(names({ search: 'priya' })).toEqual(['Priya']);
    expect(names({ search: 'father' })).toEqual(['Priya']);
    expect(names({ search: 'dinner' })).toEqual(['Priya']);
    expect(names({ search: 'rent' })).toEqual(['Rent Owner']);
  });

  test('filters combine', () => {
    expect(names({ direction: 'CREDIT', group: { id: 4 } })).toEqual(['Priya']);
    expect(names({ direction: 'CREDIT', group: { id: 1 } })).toEqual([]);
  });
});

describe('sorting', () => {
  test('largest and smallest first', () => {
    expect(names({ sort: 'LARGEST' })).toEqual(['Employer', 'Rent Owner', 'MIN*Retail', 'Priya', 'Dominos']);
    expect(names({ sort: 'SMALLEST' })).toEqual(['Dominos', 'Priya', 'MIN*Retail', 'Rent Owner', 'Employer']);
  });

  test('oldest first', () => {
    expect(names({ sort: 'OLDEST' })).toEqual(['MIN*Retail', 'Priya', 'Employer', 'Rent Owner', 'Dominos']);
  });

  test('does not change the original list', () => {
    const copy = [...rows];
    applyFilters(rows, with_({ sort: 'LARGEST' }));
    expect(rows).toEqual(copy);
  });

  test('amount sorts are flagged so the list is not grouped by day', () => {
    expect(isAmountSort('LARGEST')).toBe(true);
    expect(isAmountSort('SMALLEST')).toBe(true);
    expect(isAmountSort('NEWEST')).toBe(false);
  });
});

describe('counting active filters', () => {
  test('sort and time scope do not count as narrowing', () => {
    expect(narrowingCount(with_({ sort: 'LARGEST', allTime: true }))).toBe(0);
    expect(isDefault(with_({ sort: 'LARGEST' }))).toBe(false);
    expect(isDefault(NO_FILTERS)).toBe(true);
  });

  test('each narrowing filter counts once, and a min and max count as one', () => {
    expect(narrowingCount(with_({ direction: 'DEBIT', minPaise: 1, maxPaise: 5, mode: 'UPI' }))).toBe(3);
    expect(narrowingCount(with_({ search: '  ' }))).toBe(0);
  });
});
