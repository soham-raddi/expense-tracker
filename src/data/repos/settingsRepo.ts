// Small key/value settings stored in the encrypted database.

import type { DB } from '@op-engineering/op-sqlite';

const IMPORT_LIMIT = 'import_limit';

export async function getImportLimit(db: DB): Promise<number | null> {
  const res = await db.execute('SELECT value FROM app_settings WHERE key = ?', [IMPORT_LIMIT]);
  const value = res.rows[0]?.value;
  return value == null ? null : Number(value);
}

export async function setImportLimit(db: DB, timestamp: number | null): Promise<void> {
  if (timestamp == null) {
    await db.execute('DELETE FROM app_settings WHERE key = ?', [IMPORT_LIMIT]);
  } else {
    await db.execute('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [
      IMPORT_LIMIT,
      String(timestamp),
    ]);
  }
}
