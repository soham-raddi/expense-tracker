// ICICI Bank SMS formats. Each format is one regex with named groups.
// Only add a format when there is a matching synthetic case in fixtures/sms/icici.json.

import type { Direction, ParsedTxn, PaymentMode, RawSms } from '../../data/types';
import { parseDdMonYy, pickTimestamp, rupeesToPaise } from '../parseUtils';
import type { BankSmsParser } from './types';

const AMOUNT = String.raw`Rs\.?\s?(?<amount>[\d,]+(?:\.\d{1,2})?)`;
const DATE = String.raw`(?<date>\d{1,2}-[A-Za-z]{3}-\d{2,4})`;
const ACCT = String.raw`(?<acct>XX\d+)`;

interface Format {
  regex: RegExp;
  direction: Direction;
  mode: PaymentMode;
}

const FORMATS: Format[] = [
  // ICICI Bank Acct XX123 debited for Rs 120.00 on 28-Oct-26; NAME credited. UPI:123456789012. Call ...
  {
    regex: new RegExp(
      String.raw`ICICI Bank Acct ${ACCT} debited for ${AMOUNT} on ${DATE}; (?<payee>.+?) credited\. UPI:(?<ref>\d+)`,
    ),
    direction: 'DEBIT',
    mode: 'UPI',
  },
  // Rs 89.00 debited from ICICI Bank Savings Account XX123 on 26-Oct-26 towards MERCHANT for UPI Mandate AutoPay Retrieval Ref No.123456789012
  {
    regex: new RegExp(
      String.raw`${AMOUNT} debited from ICICI Bank \w+ Account ${ACCT} on ${DATE} towards (?<payee>.+?) for UPI Mandate AutoPay Retrieval Ref No\.?\s?(?<ref>\d+)`,
    ),
    direction: 'DEBIT',
    mode: 'AUTOPAY',
  },
  // Dear Customer, Acct XX123 is credited with Rs 10.00 on 27-Oct-26 from NAME . UPI:123456789012-ICICI Bank.
  {
    regex: new RegExp(
      String.raw`Acct ${ACCT} is credited with ${AMOUNT} on ${DATE} from (?<payee>.+?)\s*\. UPI:(?<ref>\d+)`,
    ),
    direction: 'CREDIT',
    mode: 'UPI',
  },
];

function parse(sms: RawSms): ParsedTxn | null {
  for (const format of FORMATS) {
    const g = format.regex.exec(sms.body)?.groups;
    if (!g) {
      continue;
    }
    return {
      amountPaise: rupeesToPaise(g.amount),
      direction: format.direction,
      timestamp: pickTimestamp(parseDdMonYy(g.date), sms.timestamp),
      mode: format.mode,
      payeeName: g.payee?.trim() || null,
      vpa: null, // ICICI SMS seen so far carry only the payee name, not the VPA
      upiRef: g.ref ?? null,
      maskedAccount: g.acct,
      remark: null,
      rawText: sms.body,
    };
  }
  return null;
}

export const iciciParser: BankSmsParser = { id: 'icici', parse };
