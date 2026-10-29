// ICICI Bank SMS formats. Each format is one regex with named groups.
// Only add a format when there is a matching synthetic case in fixtures/sms/icici.json.

import type { Direction, ParsedTxn, PaymentMode, RawSms } from '../../data/types';
import { parseDdMonYy, pickTimestamp, rupeesToPaise } from '../parseUtils';
import type { BankSmsParser } from './types';

const AMOUNT = String.raw`Rs\.?\s?(?<amount>[\d,]+(?:\.\d{1,2})?)`;
const BALANCE = String.raw`Rs\.?\s?(?<bal>[\d,]+(?:\.\d{1,2})?)`;
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
  // Rs 89.00 debited from ICICI Bank Savings Account XX123 on 26-Oct-26 towards NAME for UPI Mandate AutoPay Retrieval Ref No.123456789012
  // (the mandate kind varies: "UPI Mandate", "Create Mandate", ...)
  {
    regex: new RegExp(
      String.raw`${AMOUNT} debited from ICICI Bank \w+ Account ${ACCT} on ${DATE} towards (?<payee>.+?) for (?:\w+ )*?Mandate AutoPay Retrieval Ref No\.?\s?(?<ref>\d+)`,
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
  // ICICI Bank Account XX123 credited:Rs. 5,000.00 on 29-Oct-26. Info BY CASH -CITY - BRANCH SELF. Available Balance is Rs. 6,543.21.
  {
    regex: new RegExp(
      String.raw`Account ${ACCT} credited:${AMOUNT} on ${DATE}\. Info (?<payee>.+?)\. Available Balance is ${BALANCE}`,
    ),
    direction: 'CREDIT',
    mode: 'OTHER',
  },
  // Rs. 70.00 debited from ICICI Bank Acc XX123 on 11-Sep-26 MIN*Retail  C. Bal Rs. 1,234.56. If not you call ...
  // (also seen as "MIN*SHOP . Bal Rs. 171.48.")
  {
    regex: new RegExp(
      String.raw`${AMOUNT} debited from ICICI Bank Acc ${ACCT} on ${DATE}\s+(?<payee>.+?)\s*(?:C\.|\.)?\s*Bal ${BALANCE}`,
    ),
    direction: 'DEBIT',
    mode: 'OTHER',
  },
  // ICICI Bank Acc XX123 debited Rs. 2,345.60 on 22-May-26 Info1234NTC000001.Avl Bal Rs. 9,384.27.To dispute call ...
  {
    regex: new RegExp(
      String.raw`Acc ${ACCT} debited ${AMOUNT} on ${DATE} Info ?(?<payee>.+?)\.\s*Avl Bal ${BALANCE}`,
    ),
    direction: 'DEBIT',
    mode: 'OTHER',
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
      balancePaise: g.bal ? rupeesToPaise(g.bal) : null,
      maskedAccount: g.acct,
      remark: null,
      rawText: sms.body,
    };
  }
  return null;
}

export const iciciParser: BankSmsParser = { id: 'icici', parse };
