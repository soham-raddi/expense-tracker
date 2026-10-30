// Turns raw SMS into stored transactions (or Unparsed entries).

import { getDb } from '../data/db';
import {
  deleteUnparsed,
  insertSmsTxn,
  insertUnparsed,
  unparsedList,
} from '../data/repos/transactionsRepo';
import type { RawSms } from '../data/types';
import { planReprocess } from './reprocess';
import { routeSms } from './registry';
import { emitDataChanged } from '../lib/events';
import { readInbox } from './smsNative';

export type IngestOutcome = 'saved' | 'duplicate' | 'unparsed' | 'ignored';

export async function ingestSms(sms: RawSms): Promise<IngestOutcome> {
  const result = routeSms(sms);
  if (result.kind === 'ignored') {
    return 'ignored';
  }
  const db = await getDb();
  if (result.kind === 'unparsed') {
    const state = await insertUnparsed(db, sms);
    if (state === 'dismissed') {
      return 'ignored'; // you already dismissed this one
    }
    if (state === 'new') {
      emitDataChanged();
    }
    return 'unparsed';
  }
  const saved = await insertSmsTxn(db, result.txn);
  if (saved) {
    emitDataChanged();
  }
  return saved ? 'saved' : 'duplicate';
}

/** Re-checks the Unparsed list with the current parsers. Returns how many entries were resolved. */
export async function reprocessUnparsed(): Promise<number> {
  const db = await getDb();
  const plan = planReprocess(await unparsedList(db));
  for (const { id, txn } of plan.toSave) {
    await insertSmsTxn(db, txn); // false when it is already saved; either way it leaves the list
    await deleteUnparsed(db, id);
  }
  for (const id of plan.toDelete) {
    await deleteUnparsed(db, id);
  }
  const resolved = plan.toSave.length + plan.toDelete.length;
  if (resolved > 0) {
    emitDataChanged();
  }
  return resolved;
}

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

export async function importInbox(): Promise<Record<IngestOutcome, number>> {
  const counts: Record<IngestOutcome, number> = {
    saved: 0,
    duplicate: 0,
    unparsed: 0,
    ignored: 0,
  };
  await reprocessUnparsed();
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
