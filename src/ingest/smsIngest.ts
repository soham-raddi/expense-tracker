// Turns raw SMS into stored transactions (or Unparsed entries).

import { getDb } from '../data/db';
import { insertSmsTxn, insertUnparsed } from '../data/transactionsRepo';
import type { RawSms } from '../data/types';
import { routeSms } from './registry';
import { emitDataChanged } from './events';
import { readInbox } from './smsNative';

export type IngestOutcome = 'saved' | 'duplicate' | 'unparsed' | 'ignored';

export async function ingestSms(sms: RawSms): Promise<IngestOutcome> {
  const result = routeSms(sms);
  if (result.kind === 'ignored') {
    return 'ignored';
  }
  const db = await getDb();
  if (result.kind === 'unparsed') {
    await insertUnparsed(db, sms);
    emitDataChanged();
    return 'unparsed';
  }
  const saved = await insertSmsTxn(db, result.txn);
  if (saved) {
    emitDataChanged();
  }
  return saved ? 'saved' : 'duplicate';
}

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

export async function importInbox(): Promise<Record<IngestOutcome, number>> {
  const counts: Record<IngestOutcome, number> = {
    saved: 0,
    duplicate: 0,
    unparsed: 0,
    ignored: 0,
  };
  const messages = await readInbox(Date.now() - SIX_MONTHS_MS);
  for (const sms of messages) {
    counts[await ingestSms(sms)]++;
  }
  return counts;
}

/** Registered in index.js; the native receiver starts this for each new bank SMS. */
export async function smsReceivedTask(data: RawSms): Promise<void> {
  await ingestSms(data);
}
