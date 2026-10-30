// Saving and reading transactions.

import type { DB } from '@op-engineering/op-sqlite';
import { matchText, shownName } from '../../lib/names';
import { categorize, loadContext } from './categorizeRepo';
import type { LiteTxn } from '../aggregate';
import type { ParsedTxn, RawSms } from '../types';

// The same SMS can be seen twice (live, then in the inbox scan) with times a little apart.
const SAME_SMS_WINDOW_MS = 10 * 60 * 1000;

interface PayeeInfo {
  id: number;
  customName: string | null;
  defaultCategoryId: number | null;
  alwaysAsk: boolean;
}

/** Finds the payee by VPA (or by name when there is no VPA), creating it if new. */
async function upsertPayee(db: DB, txn: ParsedTxn): Promise<PayeeInfo | null> {
  if (!txn.vpa && !txn.payeeName) {
    return null;
  }
  const found = txn.vpa
    ? await db.execute('SELECT id, custom_name, default_category_id, always_ask FROM payees WHERE vpa = ?', [txn.vpa])
    : await db.execute(
        'SELECT id, custom_name, default_category_id, always_ask FROM payees WHERE vpa IS NULL AND display_name = ?',
        [txn.payeeName],
      );
  if (found.rows.length > 0) {
    const r = found.rows[0];
    return {
      id: Number(r.id),
      customName: r.custom_name == null ? null : String(r.custom_name),
      defaultCategoryId: r.default_category_id == null ? null : Number(r.default_category_id),
      alwaysAsk: Number(r.always_ask) === 1,
    };
  }
  const res = await db.execute('INSERT INTO payees (vpa, display_name) VALUES (?, ?)', [
    txn.vpa,
    txn.payeeName ?? txn.vpa,
  ]);
  return res.insertId == null ? null : { id: res.insertId, customName: null, defaultCategoryId: null, alwaysAsk: false };
}

/** Inserts an SMS transaction. Returns false if it was already stored (same UPI ref). */
export async function insertSmsTxn(db: DB, txn: ParsedTxn): Promise<boolean> {
  if (txn.upiRef) {
    const dup = await db.execute(
      'SELECT id FROM transactions WHERE upi_ref = ?',
      [txn.upiRef],
    );
    if (dup.rows.length > 0) {
      return false;
    }
  } else {
    // No ref (e.g. some card/ATM SMS): identical raw text close in time is a duplicate.
    // The live receiver and the inbox scan report slightly different times for one SMS.
    const dup = await db.execute(
      'SELECT id FROM transactions WHERE raw_text = ? AND ABS(timestamp - ?) < ?',
      [txn.rawText, txn.timestamp, SAME_SMS_WINDOW_MS],
    );
    if (dup.rows.length > 0) {
      return false;
    }
  }
  const payee = await upsertPayee(db, txn);
  const outcome = categorize(
    {
      direction: txn.direction,
      payeeName: matchText(txn.payeeName, payee?.customName ?? null),
      vpa: txn.vpa,
      remark: txn.remark,
      payeeDefaultCategoryId: payee?.defaultCategoryId ?? null,
      payeeAlwaysAsk: payee?.alwaysAsk ?? false,
    },
    await loadContext(db),
  );
  await db.execute(
    `INSERT INTO transactions
      (amount_paise, direction, timestamp, mode, payee_id, upi_ref, masked_account, remark,
       category_id, category_source, confidence, source, raw_text, balance_paise)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SMS', ?, ?)`,
    [
      txn.amountPaise,
      txn.direction,
      txn.timestamp,
      txn.mode,
      payee?.id ?? null,
      txn.upiRef,
      txn.maskedAccount,
      txn.remark,
      outcome.categoryId,
      outcome.source,
      outcome.confidence,
      txn.rawText,
      txn.balancePaise ?? null,
    ],
  );
  return true;
}

export async function insertUnparsed(db: DB, sms: RawSms): Promise<void> {
  const dup = await db.execute(
    'SELECT id FROM unparsed_sms WHERE sender = ? AND body = ? AND ABS(timestamp - ?) < ?',
    [sms.sender, sms.body, sms.timestamp, SAME_SMS_WINDOW_MS],
  );
  if (dup.rows.length === 0) {
    await db.execute(
      'INSERT INTO unparsed_sms (sender, body, timestamp) VALUES (?, ?, ?)',
      [sms.sender, sms.body, sms.timestamp],
    );
  }
}

export interface TxnRow {
  id: number;
  amountPaise: number;
  direction: 'DEBIT' | 'CREDIT';
  timestamp: number;
  mode: string;
  payeeId: number | null;
  payeeName: string | null; // what to show: your own name for the payee, or else the bank's
  payeeOriginalName: string | null; // exactly what the bank sent
  payeeCustomName: string | null;
  payeeAlwaysAsk: boolean;
  upiRef: string | null;
  maskedAccount: string | null;
  balancePaise: number | null;
  rawText: string;
  source: 'SMS' | 'STATEMENT' | 'BOTH';
  categoryId: number | null;
  categoryName: string | null;
  categoryColour: string | null;
  excluded: boolean; // its group does not count towards totals (e.g. Transfers (self))
}

const TXN_SELECT = `SELECT t.id, t.amount_paise, t.direction, t.timestamp, t.mode, t.upi_ref, t.masked_account,
    t.payee_id, p.display_name, p.custom_name, p.always_ask, t.balance_paise, t.raw_text, t.source, t.category_id, c.name AS category_name,
    c.colour AS category_colour, COALESCE(c.exclude_from_totals, 0) AS excluded
  FROM transactions t
  LEFT JOIN payees p ON p.id = t.payee_id
  LEFT JOIN categories c ON c.id = t.category_id`;

/** Transactions with from <= timestamp < to, newest first. */
export async function transactionsBetween(db: DB, from: number, to: number): Promise<TxnRow[]> {
  const res = await db.execute(
    `${TXN_SELECT} WHERE t.timestamp >= ? AND t.timestamp < ? ORDER BY t.timestamp DESC, t.id DESC`,
    [from, to],
  );
  return res.rows.map(r => ({
    id: Number(r.id),
    amountPaise: Number(r.amount_paise),
    direction: r.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
    timestamp: Number(r.timestamp),
    mode: String(r.mode),
    payeeId: r.payee_id == null ? null : Number(r.payee_id),
    payeeName: shownName(
      r.display_name == null ? null : String(r.display_name),
      r.custom_name == null ? null : String(r.custom_name),
    ),
    payeeOriginalName: r.display_name == null ? null : String(r.display_name),
    payeeCustomName: r.custom_name == null ? null : String(r.custom_name),
    payeeAlwaysAsk: Number(r.always_ask) === 1,
    upiRef: r.upi_ref == null ? null : String(r.upi_ref),
    maskedAccount: r.masked_account == null ? null : String(r.masked_account),
    balancePaise: r.balance_paise == null ? null : Number(r.balance_paise),
    rawText: String(r.raw_text),
    source: r.source === 'STATEMENT' || r.source === 'BOTH' ? r.source : 'SMS',
    categoryId: r.category_id == null ? null : Number(r.category_id),
    categoryName: r.category_name == null ? null : String(r.category_name),
    categoryColour: r.category_colour == null ? null : String(r.category_colour),
    excluded: Number(r.excluded) === 1,
  }));
}

/** Every transaction, only the fields needed to total up months. */
export async function allTransactionsLite(db: DB): Promise<LiteTxn[]> {
  const res = await db.execute(
    `SELECT t.timestamp, t.amount_paise, t.direction, COALESCE(c.exclude_from_totals, 0) AS excluded
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id`,
  );
  return res.rows.map(r => ({
    timestamp: Number(r.timestamp),
    amountPaise: Number(r.amount_paise),
    direction: r.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
    excluded: Number(r.excluded) === 1,
  }));
}

export interface UnparsedRow {
  id: number;
  sender: string;
  body: string;
  timestamp: number;
}

export async function unparsedList(db: DB): Promise<UnparsedRow[]> {
  const res = await db.execute(
    'SELECT id, sender, body, timestamp FROM unparsed_sms ORDER BY timestamp DESC',
  );
  return res.rows.map(r => ({
    id: Number(r.id),
    sender: String(r.sender),
    body: String(r.body),
    timestamp: Number(r.timestamp),
  }));
}

export async function deleteUnparsed(db: DB, id: number): Promise<void> {
  await db.execute('DELETE FROM unparsed_sms WHERE id = ?', [id]);
}

export async function unparsedCount(db: DB): Promise<number> {
  const res = await db.execute('SELECT COUNT(*) AS n FROM unparsed_sms');
  return Number(res.rows[0]?.n ?? 0);
}
