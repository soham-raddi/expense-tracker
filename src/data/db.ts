// Opens the SQLCipher-encrypted database, runs migrations and seeds defaults.

import { open, type DB } from '@op-engineering/op-sqlite';
import { getOrCreateDbKey } from './dbKey';
import { MIGRATIONS } from './schema';
import { recategorizeUncategorized } from './repos/categorizeRepo';
import { seedDefaults, seedRulesV2 } from './seed';

let dbPromise: Promise<DB> | null = null;

export function getDb(): Promise<DB> {
  if (!dbPromise) {
    dbPromise = openDb();
  }
  return dbPromise;
}

async function openDb(): Promise<DB> {
  const encryptionKey = await getOrCreateDbKey();
  const db = open({ name: 'upitracker.db', encryptionKey });
  await db.execute('PRAGMA foreign_keys = ON');
  await migrate(db);
  await recategorizeUncategorized(db);
  return db;
}

async function migrate(db: DB): Promise<void> {
  const res = await db.execute('PRAGMA user_version');
  const current = Number(res.rows[0]?.user_version ?? 0);
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.transaction(async tx => {
      for (const sql of MIGRATIONS[v]) {
        await tx.execute(sql);
      }
      if (v === 0) {
        await seedDefaults(tx);
      }
      if (v === 2) {
        await seedRulesV2(tx);
      }
      await tx.execute(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
