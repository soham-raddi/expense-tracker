// Imports statement text: rows already known from SMS are matched (and gain the statement's
// balance), all others are added. Safe to run again on the same or an overlapping statement.

import { getDb } from '../../data/db';
import { saveTxn } from '../../data/repos/transactionsRepo';
import { emitDataChanged } from '../../lib/events';
import { reconcile, type StoredTxn } from '../reconcile';
import { parseIciciStatement } from './iciciStatement';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ImportSummary {
  bank: string;
  rowsRead: number;
  alreadyHad: number; // matched to payments you already had
  added: number;
  skippedDeleted: number; // rows for payments you deleted earlier
  unreadable: string[]; // rows that could not be read
  complete: boolean; // opening + rows = closing and the bank's totals agree
  openingPaise: number | null;
  closingPaise: number | null;
  fromDate: number | null;
  toDate: number | null;
}

/** True if the text looks like a statement this app can read. */
export function looksLikeStatement(text: string): boolean {
  return /Statement of Transactions/i.test(text);
}

export async function importStatementText(text: string): Promise<ImportSummary> {
  const parsed = parseIciciStatement(text);
  const rows = parsed.rows.map(r => ({ txn: r.txn, balancePaise: r.balancePaise }));
  const summary: ImportSummary = {
    bank: 'ICICI Bank',
    rowsRead: rows.length,
    alreadyHad: 0,
    added: 0,
    skippedDeleted: 0,
    unreadable: parsed.unreadable,
    complete: parsed.complete,
    openingPaise: parsed.openingPaise,
    closingPaise: parsed.closingPaise,
    fromDate: rows.length ? rows[0].txn.timestamp : null,
    toDate: rows.length ? rows[rows.length - 1].txn.timestamp : null,
  };
  if (rows.length === 0 || summary.fromDate == null || summary.toDate == null) {
    return summary;
  }

  const db = await getDb();
  const stored = await db.execute(
    `SELECT id, upi_ref, amount_paise, direction, timestamp, balance_paise, source
     FROM transactions WHERE timestamp >= ? AND timestamp < ?`,
    [summary.fromDate - 2 * DAY_MS, summary.toDate + 3 * DAY_MS],
  );
  const sources = new Map<number, string>();
  const known: StoredTxn[] = stored.rows.map(r => {
    sources.set(Number(r.id), String(r.source));
    return {
      id: Number(r.id),
      upiRef: r.upi_ref == null ? null : String(r.upi_ref),
      amountPaise: Number(r.amount_paise),
      direction: String(r.direction),
      timestamp: Number(r.timestamp),
      balancePaise: r.balance_paise == null ? null : Number(r.balance_paise),
    };
  });

  const plan = reconcile(rows, known);
  for (const { rowIndex, txnId } of plan.matched) {
    summary.alreadyHad++;
    await db.execute(
      `UPDATE transactions SET balance_paise = COALESCE(balance_paise, ?),
         source = CASE WHEN source = 'SMS' THEN 'BOTH' ELSE source END WHERE id = ?`,
      [rows[rowIndex].balancePaise, txnId],
    );
  }
  for (const i of plan.newRows) {
    if (await saveTxn(db, rows[i].txn, 'STATEMENT')) {
      summary.added++;
    } else {
      summary.skippedDeleted++;
    }
  }

  await db.execute(
    `INSERT INTO statement_imports
       (imported_at, bank_id, masked_account, from_date, to_date, rows_read, rows_matched, rows_new, rows_failed)
     VALUES (?, 'ICICI', ?, ?, ?, ?, ?, ?, ?)`,
    [Date.now(), parsed.maskedAccount, summary.fromDate, summary.toDate, rows.length, summary.alreadyHad, summary.added, summary.unreadable.length],
  );
  emitDataChanged();
  return summary;
}
