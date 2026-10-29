// When a parser learns a new format, messages already sitting in the Unparsed list may now be
// understood. This decides what to do with each one. Pure logic, so it is easy to test.

import type { ParsedTxn } from '../data/types';
import { routeSms } from './registry';

export interface UnparsedItem {
  id: number;
  sender: string;
  body: string;
  timestamp: number;
}

export interface ReprocessPlan {
  toSave: { id: number; txn: ParsedTxn }[]; // now understood: save as a payment, then remove from the list
  toDelete: number[]; // now known to be noise (OTP, promo, notice): remove from the list
}

/** Messages that still cannot be read are left alone. */
export function planReprocess(items: UnparsedItem[]): ReprocessPlan {
  const plan: ReprocessPlan = { toSave: [], toDelete: [] };
  for (const item of items) {
    const result = routeSms({ sender: item.sender, body: item.body, timestamp: item.timestamp });
    if (result.kind === 'txn') {
      plan.toSave.push({ id: item.id, txn: result.txn });
    } else if (result.kind === 'ignored') {
      plan.toDelete.push(item.id);
    }
  }
  return plan;
}
