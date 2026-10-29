import type { ParsedTxn, RawSms } from '../../data/types';

/**
 * One per bank. Adding a bank = a new file implementing this, registered in
 * ../registry.ts, plus its sender codes in src/config/banks.json and a fixture
 * file in fixtures/sms/.
 */
export interface BankSmsParser {
  id: string; // key in src/config/banks.json, e.g. "icici"
  /** Returns null if this SMS is not in any format the parser knows. */
  parse(sms: RawSms): ParsedTxn | null;
}
