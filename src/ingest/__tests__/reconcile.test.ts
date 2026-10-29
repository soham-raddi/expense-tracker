// All values are made up.
import type { ParsedTxn } from '../../data/types';
import { reconcile, type StatementRow, type StoredTxn } from '../reconcile';

const day = (d: number, hour = 0) => Date.parse(`2026-10-${String(d).padStart(2, '0')}T00:00:00+05:30`) + hour * 3600000;

function row(over: Partial<ParsedTxn> & { balancePaise?: number | null }): StatementRow {
  const { balancePaise = null, ...txn } = over;
  return {
    balancePaise,
    txn: {
      amountPaise: 6000,
      direction: 'DEBIT',
      timestamp: day(10),
      mode: 'UPI',
      payeeName: null,
      vpa: null,
      upiRef: null,
      maskedAccount: null,
      remark: null,
      rawText: 'row',
      ...txn,
    },
  };
}

function stored(over: Partial<StoredTxn>): StoredTxn {
  return {
    id: 1,
    upiRef: null,
    amountPaise: 6000,
    direction: 'DEBIT',
    timestamp: day(10, 14),
    balancePaise: null,
    ...over,
  };
}

test('matches by UPI ref even when the date differs', () => {
  const plan = reconcile(
    [row({ upiRef: '111', timestamp: day(20) })],
    [stored({ upiRef: '111', timestamp: day(10) })],
  );
  expect(plan.matched).toEqual([{ rowIndex: 0, txnId: 1 }]);
  expect(plan.newRows).toEqual([]);
});

test('matches SMS without ref by amount, direction and date ±1 day', () => {
  const plan = reconcile([row({})], [stored({ timestamp: day(11, 1) })]);
  expect(plan.matched).toHaveLength(1);
});

test('does not match two days apart, a different amount or a different direction', () => {
  expect(reconcile([row({})], [stored({ timestamp: day(12, 1) })]).newRows).toEqual([0]);
  expect(reconcile([row({})], [stored({ amountPaise: 6100 })]).newRows).toEqual([0]);
  expect(reconcile([row({})], [stored({ direction: 'CREDIT' })]).newRows).toEqual([0]);
});

test('different refs are different payments', () => {
  const plan = reconcile([row({ upiRef: '111' })], [stored({ upiRef: '222' })]);
  expect(plan.newRows).toEqual([0]);
});

test('two identical statement rows with one stored match once and add one', () => {
  const plan = reconcile([row({}), row({})], [stored({})]);
  expect(plan.matched).toHaveLength(1);
  expect(plan.newRows).toEqual([1]);
});

test('re-importing an overlapping statement adds nothing', () => {
  const rows = [
    row({ balancePaise: 94000 }),
    row({ balancePaise: 88000 }),
    row({ amountPaise: 500, balancePaise: 87500 }),
  ];
  const first = reconcile(rows, []);
  expect(first.newRows).toEqual([0, 1, 2]);
  const afterFirst: StoredTxn[] = rows.map((r, i) => ({
    id: i + 1,
    upiRef: null,
    amountPaise: r.txn.amountPaise,
    direction: r.txn.direction,
    timestamp: r.txn.timestamp,
    balancePaise: r.balancePaise,
  }));
  const second = reconcile(rows, afterFirst);
  expect(second.newRows).toEqual([]);
  expect(second.matched).toHaveLength(3);
});

test('with balances, identical payments on one day are kept apart', () => {
  const storedRows = [stored({ id: 1, timestamp: day(10), balancePaise: 94000 })];
  const plan = reconcile(
    [row({ balancePaise: 94000 }), row({ balancePaise: 88000 })],
    storedRows,
  );
  expect(plan.matched).toEqual([{ rowIndex: 0, txnId: 1 }]);
  expect(plan.newRows).toEqual([1]);
});

test('balances that differ do not match even on the same day', () => {
  const plan = reconcile(
    [row({ balancePaise: 88000 })],
    [stored({ timestamp: day(10), balancePaise: 94000 })],
  );
  expect(plan.newRows).toEqual([0]);
});
