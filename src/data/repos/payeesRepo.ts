// Names you give to payees.

import type { DB } from '@op-engineering/op-sqlite';

/** Sets your own name for a payee; null puts back the bank's name. Applies to all its payments. */
export async function setPayeeCustomName(db: DB, payeeId: number, name: string | null): Promise<void> {
  await db.execute('UPDATE payees SET custom_name = ? WHERE id = ?', [name, payeeId]);
}
