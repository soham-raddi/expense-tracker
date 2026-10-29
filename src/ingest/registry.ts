// Routes each SMS to the right bank parser by sender ID.

import banks from '../config/banks.json';
import type { ParsedTxn, RawSms } from '../data/types';
import { isNotice, isOtp, looksLikeTransaction } from './filters';
import type { BankSmsParser } from './banks/types';
import { iciciParser } from './banks/icici';

export const PARSERS: BankSmsParser[] = [iciciParser];

type BankConfig = { name: string; senderCodes: string[] };
const bankConfigs = banks as unknown as Record<string, BankConfig>;

/** "VM-ICICIT" / "AD-ICICIB-S" / "ICICIB" -> "ICICIB". */
export function senderCode(sender: string): string {
  const parts = sender.toUpperCase().split('-');
  return parts.length >= 2 ? parts[1] : parts[0];
}

export function parserForSender(sender: string): BankSmsParser | null {
  const code = senderCode(sender);
  return (
    PARSERS.find(p => bankConfigs[p.id]?.senderCodes.includes(code)) ?? null
  );
}

export type RouteResult =
  | { kind: 'txn'; txn: ParsedTxn }
  | { kind: 'unparsed' } // from a known bank and looks like a transaction, but no format matched
  | { kind: 'ignored' }; // not a bank sender, OTP, promotional, or a notice of a future payment

export function routeSms(sms: RawSms): RouteResult {
  const parser = parserForSender(sms.sender);
  if (!parser || isOtp(sms.body) || isNotice(sms.body) || !looksLikeTransaction(sms.body)) {
    return { kind: 'ignored' };
  }
  const txn = parser.parse(sms);
  return txn ? { kind: 'txn', txn } : { kind: 'unparsed' };
}
