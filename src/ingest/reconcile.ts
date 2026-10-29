// Decides which statement rows are already stored. Pure logic: no database, so it is easy to test.
// Works for any statement range and for overlapping imports.

import type { ParsedTxn } from '../data/types';

export interface StatementRow {
  txn: ParsedTxn; // timestamp is midnight IST of the statement date
  balancePaise: number | null; // running balance after this row, if the statement has one
}

/** A transaction already in the database. */
export interface StoredTxn {
  id: number;
  upiRef: string | null;
  amountPaise: number;
  direction: string;
  timestamp: number;
  balancePaise: number | null;
}

export interface ReconcilePlan {
  matched: { rowIndex: number; txnId: number }[];
  newRows: number[]; // indexes into the statement rows
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function istDay(timestamp: number): number {
  return Math.floor((timestamp + IST_OFFSET_MS) / DAY_MS);
}

/**
 * 1. Match by UPI ref.
 * 2. Otherwise match by amount + direction + date (±1 day). If both sides have a running
 *    balance, the balances must be equal and the day the same, which keeps identical
 *    payments on one day apart.
 * Each stored transaction is matched at most once, so two identical statement rows with one
 * stored transaction give one match and one new row.
 */
export function reconcile(rows: StatementRow[], stored: StoredTxn[]): ReconcilePlan {
  const used = new Set<number>();
  const matchedRows = new Map<number, number>();

  const byRef = new Map<string, StoredTxn>();
  for (const s of stored) {
    if (s.upiRef) {
      byRef.set(s.upiRef, s);
    }
  }
  rows.forEach((row, i) => {
    const hit = row.txn.upiRef ? byRef.get(row.txn.upiRef) : undefined;
    if (hit && !used.has(hit.id)) {
      used.add(hit.id);
      matchedRows.set(i, hit.id);
    }
  });

  rows.forEach((row, i) => {
    if (matchedRows.has(i)) {
      return;
    }
    const rowDay = istDay(row.txn.timestamp);
    let best: { s: StoredTxn; distance: number } | null = null;
    for (const s of stored) {
      if (used.has(s.id) || s.amountPaise !== row.txn.amountPaise) {
        continue;
      }
      if (s.direction !== row.txn.direction) {
        continue;
      }
      if (s.upiRef && row.txn.upiRef && s.upiRef !== row.txn.upiRef) {
        continue; // both have refs and they differ: different payments
      }
      const distance = Math.abs(istDay(s.timestamp) - rowDay);
      if (s.balancePaise != null && row.balancePaise != null) {
        if (s.balancePaise !== row.balancePaise || distance !== 0) {
          continue;
        }
      } else if (distance > 1) {
        continue;
      }
      if (!best || distance < best.distance) {
        best = { s, distance };
      }
    }
    if (best) {
      used.add(best.s.id);
      matchedRows.set(i, best.s.id);
    }
  });

  const plan: ReconcilePlan = { matched: [], newRows: [] };
  rows.forEach((_, i) => {
    const txnId = matchedRows.get(i);
    if (txnId == null) {
      plan.newRows.push(i);
    } else {
      plan.matched.push({ rowIndex: i, txnId });
    }
  });
  return plan;
}
