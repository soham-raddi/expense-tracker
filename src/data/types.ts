// Core types shared by ingestion, categorization and storage.

export type Direction = 'DEBIT' | 'CREDIT';

export type PaymentMode =
  | 'UPI'
  | 'CARD'
  | 'NEFT'
  | 'IMPS'
  | 'ATM'
  | 'AUTOPAY'
  | 'OTHER';

export type CategorySource =
  | 'PAYEE_MEMORY'
  | 'CONTACT'
  | 'RULE'
  | 'REMARK'
  | 'HEURISTIC'
  | 'USER'
  | 'NONE';

export type TxnSource = 'SMS' | 'STATEMENT' | 'BOTH';

export type PayeeKind = 'PERSON' | 'MERCHANT' | 'UNKNOWN';

export type PayeeRelation = 'FAMILY' | 'FRIEND' | 'KNOWN';

export type RuleField = 'PAYEE_NAME' | 'VPA' | 'REMARK';

/** An SMS as read from the inbox or received live. */
export interface RawSms {
  sender: string; // e.g. "VM-ICICIT"
  body: string;
  timestamp: number; // epoch ms when the phone received it
}

/** What every bank parser (SMS or statement) produces. */
export interface ParsedTxn {
  amountPaise: number; // integer paise, never floats of rupees
  direction: Direction;
  timestamp: number; // epoch ms
  mode: PaymentMode;
  payeeName: string | null;
  vpa: string | null; // lowercase
  upiRef: string | null;
  maskedAccount: string | null; // last digits only, e.g. "XX123"
  remark: string | null;
  rawText: string;
}
