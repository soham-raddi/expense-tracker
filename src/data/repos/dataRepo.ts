// Deleting your data: one payment, or everything.

import type { DB } from '@op-engineering/op-sqlite';
import { fingerprint } from '../../lib/hash';
import { setImportLimit } from './settingsRepo';

// The same SMS can be seen twice (live, then in the inbox scan) with times a little apart.
const SAME_SMS_WINDOW_MS = 10 * 60 * 1000;

export interface DeletableTxn {
  id: number;
  payeeId: number | null;
  upiRef: string | null;
  rawText: string;
  timestamp: number;
}

/** True if this message belongs to a payment you deleted earlier. */
export async function wasDeleted(
  db: DB,
  msg: { upiRef: string | null; rawText: string; timestamp: number },
): Promise<boolean> {
  const res = await db.execute(
    `SELECT 1 FROM deleted_txns
     WHERE (? IS NOT NULL AND upi_ref = ?) OR (text_hash = ? AND ABS(timestamp - ?) < ?)
     LIMIT 1`,
    [msg.upiRef, msg.upiRef, fingerprint(msg.rawText), msg.timestamp, SAME_SMS_WINDOW_MS],
  );
  return res.rows.length > 0;
}

/** Deletes one payment for good. Only a fingerprint is kept, so a re-scan will not restore it. */
export async function deleteTransaction(db: DB, txn: DeletableTxn): Promise<void> {
  await db.execute('INSERT INTO deleted_txns (upi_ref, text_hash, timestamp) VALUES (?, ?, ?)', [
    txn.upiRef,
    fingerprint(txn.rawText),
    txn.timestamp,
  ]);
  await db.execute('DELETE FROM transactions WHERE id = ?', [txn.id]);
  if (txn.payeeId != null) {
    // Forget the payee too, unless you gave it a name, a group or "always ask".
    await db.execute(
      `DELETE FROM payees WHERE id = ? AND custom_name IS NULL AND default_category_id IS NULL
         AND always_ask = 0 AND NOT EXISTS (SELECT 1 FROM transactions WHERE payee_id = payees.id)`,
      [txn.payeeId],
    );
  }
}

/**
 * Deletes every payment, payee, unparsed message and import record. Your groups and rules stay.
 * With `ignoreOlderMessages`, messages received before now are skipped by later imports,
 * because the originals are still in your phone's inbox.
 */
export async function deleteAllData(db: DB, ignoreOlderMessages: boolean): Promise<void> {
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM transactions');
    await tx.execute('DELETE FROM payees');
    await tx.execute('DELETE FROM unparsed_sms');
    await tx.execute('DELETE FROM statement_imports');
    await tx.execute('DELETE FROM deleted_txns');
  });
  await setImportLimit(db, ignoreOlderMessages ? Date.now() : null);
  // Squeeze out the freed pages so deleted text is not left behind in the database file.
  await db.execute('VACUUM');
}
