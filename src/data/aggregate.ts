// Totals by month and by group. Pure functions, so they are easy to test.
// Money moved between your own accounts (groups marked "exclude from totals") is left out.

import { addMonths, monthOf, sameMonth, type MonthRef } from '../ui/format';

export interface LiteTxn {
  timestamp: number;
  amountPaise: number;
  direction: 'DEBIT' | 'CREDIT';
  excluded: boolean;
}

export interface Totals {
  spentPaise: number;
  receivedPaise: number;
  count: number; // payments that count towards the totals
}

export function totalsOf(rows: { amountPaise: number; direction: string; excluded: boolean }[]): Totals {
  const totals: Totals = { spentPaise: 0, receivedPaise: 0, count: 0 };
  for (const r of rows) {
    if (r.excluded) {
      continue;
    }
    totals.count++;
    if (r.direction === 'CREDIT') {
      totals.receivedPaise += r.amountPaise;
    } else {
      totals.spentPaise += r.amountPaise;
    }
  }
  return totals;
}

export interface MonthTotals extends Totals {
  month: MonthRef;
}

/** One entry per month that has data, newest first. */
export function monthlyTotals(rows: LiteTxn[]): MonthTotals[] {
  const buckets = new Map<string, { month: MonthRef; rows: LiteTxn[] }>();
  for (const r of rows) {
    const month = monthOf(r.timestamp);
    const key = `${month.year}-${month.month}`;
    const bucket = buckets.get(key) ?? { month, rows: [] };
    bucket.rows.push(r);
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .sort((a, b) => b.month.year * 12 + b.month.month - (a.month.year * 12 + a.month.month))
    .map(b => ({ month: b.month, ...totalsOf(b.rows) }));
}

/** The last `count` months ending at `end`, including months with no data (for a trend bar). */
export function fillMonths(totals: MonthTotals[], end: MonthRef, count: number): MonthTotals[] {
  const result: MonthTotals[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const month = addMonths(end, -i);
    result.push(
      totals.find(t => sameMonth(t.month, month)) ?? { month, spentPaise: 0, receivedPaise: 0, count: 0 },
    );
  }
  return result;
}

export interface BreakdownRow {
  amountPaise: number;
  direction: string;
  excluded: boolean;
  categoryId: number | null;
  categoryName: string | null;
  categoryColour: string | null;
}

export interface GroupSlice {
  categoryId: number | null; // null = not in any group yet
  name: string;
  colour: string | null;
  spentPaise: number;
  count: number;
  share: number; // 0-1 of the month's spending
}

/** Spending per group, biggest first. Payments without a group are one "Uncategorized" slice. */
export function groupBreakdown(rows: BreakdownRow[]): GroupSlice[] {
  const slices = new Map<number | null, GroupSlice>();
  let total = 0;
  for (const r of rows) {
    if (r.excluded || r.direction !== 'DEBIT') {
      continue;
    }
    total += r.amountPaise;
    const slice = slices.get(r.categoryId) ?? {
      categoryId: r.categoryId,
      name: r.categoryName ?? 'Uncategorized',
      colour: r.categoryColour,
      spentPaise: 0,
      count: 0,
      share: 0,
    };
    slice.spentPaise += r.amountPaise;
    slice.count++;
    slices.set(r.categoryId, slice);
  }
  return [...slices.values()]
    .map(s => ({ ...s, share: total === 0 ? 0 : s.spentPaise / total }))
    .sort((a, b) => b.spentPaise - a.spentPaise);
}
