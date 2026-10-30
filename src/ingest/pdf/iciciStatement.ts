// Reads the text of an ICICI savings account statement into transactions.
// Every row is kept, UPI or not. Whether a row is money in or out comes from the running balance,
// not from which column the amount sat in, because column positions get lost in extracted text.

import type { ParsedTxn, PaymentMode } from '../../data/types';
import { rupeesToPaise } from '../parseUtils';

export interface StatementRowOut {
  txn: ParsedTxn;
  balancePaise: number;
}

export interface StatementResult {
  rows: StatementRowOut[];
  openingPaise: number | null;
  closingPaise: number | null;
  /** Text of rows that could not be read, so nothing disappears quietly. */
  unreadable: string[];
  /** Bank's own "Total:" lines against what was read; null when the statement has none. */
  totalsMatch: boolean | null;
  /** True only when opening + money in - money out = closing, every row read, and totals agree. */
  complete: boolean;
  maskedAccount: string | null;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DATE_AT_START = /^(\d{2})-(\d{2})-(\d{4})\b/;
const AMOUNT = /^-?\d{1,3}(?:,\d{3})*\.\d{2}$/;
const HEADER_WORDS = new Set(['DATE', 'MODE', 'PARTICULARS', 'DEPOSITS', 'WITHDRAWALS', 'BALANCE']);
const MODE_COLUMN = /^(net banking|cheque|cash|internet)$/i; // the MODE column's text, not a description
const MODE_PREFIX = /^(net banking|cheque|internet)\s+/i; // same text when the row is read as one line
const NO_REMARK = /^(upi|no remark|upiintent|mandatereq|mandateexe|collect-pa\w*|payment fo\w*|pay for \w*)$/i;

function dateToTimestamp(d: string, m: string, y: string): number {
  return Date.UTC(Number(y), Number(m) - 1, Number(d)) - IST_OFFSET_MS;
}

function toPaise(token: string): number {
  return rupeesToPaise(token.replace(/^-/, '').replace(/\s/g, ''));
}

function signedPaise(token: string): number {
  return token.startsWith('-') ? -toPaise(token) : toPaise(token);
}

/** The lines between "Statement of Transactions" and whatever follows the table. */
function transactionSection(text: string): string[] {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const start = lines.findIndex(l => /^Statement of Transactions/i.test(l));
  if (start < 0) {
    return [];
  }
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(Summary of TDS|Account Related Other Information|Legends for transactions)/i.test(lines[i])) {
      break;
    }
    out.push(lines[i]);
  }
  return out;
}

interface Block {
  date: string;
  lines: string[];
  amounts: string[];
}

/** For "BIL/INFT/FI123/ SOME NAME" style strings: the last part that looks like a name. */
function lastNamedSegment(p: string): string | null {
  const parts = p.split('/').map(s => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/[A-Za-z]{3}/.test(parts[i]) && !/^[A-Z]{2,5}\d/.test(parts[i])) {
      return parts[i];
    }
  }
  return null;
}

function modeAndPayee(particulars: string, firstLine: string): { mode: PaymentMode; payee: string | null } {
  const p = particulars.trim();
  const upper = p.toUpperCase();
  if (/INT\.PD/i.test(p)) {
    return { mode: 'OTHER', payee: 'Interest' };
  }
  if (upper.startsWith('ACH/')) {
    return { mode: 'AUTOPAY', payee: (p.split('/')[1] ?? '').trim() || null };
  }
  if (upper.startsWith('NEFT')) {
    return { mode: 'NEFT', payee: lastNamedSegment(p) };
  }
  if (/^(IMPS|MMT)/.test(upper)) {
    return { mode: 'IMPS', payee: lastNamedSegment(p) };
  }
  if (/^(ATM|NFS|VAT|MAT|CASH)/.test(upper)) {
    return { mode: 'ATM', payee: 'Cash withdrawal' };
  }
  if (/^(VPS|IPS|POS)/.test(upper)) {
    return { mode: 'CARD', payee: lastNamedSegment(p) };
  }
  if (upper.startsWith('MIN/')) {
    return { mode: 'OTHER', payee: (p.split('/')[1] ?? '').trim() || null };
  }
  if (/^(BIL|INF)\//.test(upper)) {
    return { mode: 'OTHER', payee: lastNamedSegment(p) };
  }
  if (upper.startsWith('EBA/')) {
    return { mode: 'OTHER', payee: 'ICICI Direct' };
  }
  // Free text such as "Dr Tran For Funding iWish A/c" or a refund line.
  return { mode: 'OTHER', payee: firstLine.replace(/\s+/g, ' ').slice(0, 60) || null };
}

function parseBlock(block: Block, prevBalance: number, account: string | null): StatementRowOut | null {
  if (block.amounts.length < 2) {
    return null;
  }
  const amount = toPaise(block.amounts[block.amounts.length - 2]);
  const balance = signedPaise(block.amounts[block.amounts.length - 1]);
  const delta = balance - prevBalance;
  if (amount === 0 || Math.abs(delta) !== amount) {
    return null;
  }
  const [d, m, y] = block.date.split('-');
  const joined = block.lines.join(' ').replace(/\s+/g, ' ').trim();

  let mode: PaymentMode;
  let payee: string | null;
  let vpa: string | null = null;
  let upiRef: string | null = null;
  let remark: string | null = null;

  const upi = /UPI\/([^/]*)\/([^/]*)\/([^/]*)\/(.*?)\/(\d{12})\//.exec(joined);
  if (upi) {
    const nameLine = block.lines[0] && !/^UPI\//i.test(block.lines[0]) ? block.lines[0].trim() : null;
    mode = /MandateReq|MandateExe/i.test(upi[3]) ? 'AUTOPAY' : 'UPI';
    payee = nameLine ?? upi[1].trim();
    vpa = upi[2].includes('@') ? upi[2].trim().toLowerCase() : null;
    upiRef = upi[5];
    remark = NO_REMARK.test(upi[3].trim()) ? null : upi[3].trim();
  } else {
    ({ mode, payee } = modeAndPayee(joined, block.lines[0] ?? ''));
  }

  return {
    balancePaise: balance,
    txn: {
      amountPaise: amount,
      direction: delta > 0 ? 'CREDIT' : 'DEBIT',
      timestamp: dateToTimestamp(d, m, y),
      mode,
      payeeName: payee,
      vpa,
      upiRef,
      balancePaise: balance,
      maskedAccount: account,
      remark,
      rawText: joined,
    },
  };
}

/** Puts text on the row, pulling out amount tokens. */
function addText(block: Block, text: string): void {
  const words: string[] = [];
  for (const t of text.split(/\s+/)) {
    if (AMOUNT.test(t)) {
      block.amounts.push(t);
    } else {
      words.push(t);
    }
  }
  const kept = words.join(' ').replace(MODE_PREFIX, '').trim();
  if (kept && !MODE_COLUMN.test(kept)) {
    block.lines.push(kept);
  }
}

export function parseIciciStatement(text: string): StatementResult {
  const account = /Savings Account\s+X*(\d{3})\d?\b/i.exec(text);
  const masked = account ? `XX${account[1]}` : null;
  const lines = transactionSection(text);

  let opening: number | null = null;
  let waitingForOpening = false;
  const blocks: Block[] = [];
  let current: Block | null = null;
  const totals: { deposits: number; withdrawals: number }[] = [];
  let totalAmounts: string[] | null = null;

  const closeTotals = () => {
    if (totalAmounts && totalAmounts.length >= 2) {
      totals.push({ deposits: toPaise(totalAmounts[0]), withdrawals: toPaise(totalAmounts[1]) });
    }
    totalAmounts = null;
  };

  for (const line of lines) {
    if (!line || HEADER_WORDS.has(line.toUpperCase()) || /^DATE.*BALANCE$/i.test(line) || /^Page \d+ of \d+/i.test(line)) {
      continue;
    }
    const compact = line.replace(/\s/g, '');
    if (/^Total:?/i.test(line)) {
      closeTotals();
      totalAmounts = line.split(/\s+/).filter(t => AMOUNT.test(t));
      continue;
    }
    if (totalAmounts && AMOUNT.test(compact) && totalAmounts.length < 3) {
      totalAmounts.push(compact);
      continue;
    }
    closeTotals();

    if (/^B\/F\b/i.test(line)) {
      const found = line.split(/\s+/).find(t => AMOUNT.test(t));
      if (found) {
        opening = signedPaise(found);
      } else {
        waitingForOpening = true;
      }
      continue;
    }
    if (waitingForOpening && AMOUNT.test(compact)) {
      opening = signedPaise(compact);
      waitingForOpening = false;
      continue;
    }
    const dated = DATE_AT_START.exec(line);
    if (dated) {
      if (current) {
        blocks.push(current);
      }
      current = { date: `${dated[1]}-${dated[2]}-${dated[3]}`, lines: [], amounts: [] };
      const rest = line.slice(dated[0].length).trim();
      if (rest) {
        addText(current, rest);
      }
      continue;
    }
    if (current) {
      addText(current, line);
    }
  }
  closeTotals();
  if (current) {
    blocks.push(current);
  }

  const rows: StatementRowOut[] = [];
  const unreadable: string[] = [];
  let prev = opening ?? 0;
  for (const block of blocks) {
    const row = opening == null ? null : parseBlock(block, prev, masked);
    if (row) {
      rows.push(row);
      prev = row.balancePaise;
    } else {
      unreadable.push(`${block.date} ${block.lines.join(' ')} ${block.amounts.join(' ')}`.trim());
      const last = block.amounts[block.amounts.length - 1];
      if (last) {
        prev = signedPaise(last);
      }
    }
  }

  const closing = rows.length > 0 ? rows[rows.length - 1].balancePaise : opening;
  const credits = rows.filter(r => r.txn.direction === 'CREDIT').reduce((s, r) => s + r.txn.amountPaise, 0);
  const debits = rows.filter(r => r.txn.direction === 'DEBIT').reduce((s, r) => s + r.txn.amountPaise, 0);
  const totalsMatch =
    totals.length === 0
      ? null
      : totals.reduce((s, t) => s + t.deposits, 0) === credits &&
        totals.reduce((s, t) => s + t.withdrawals, 0) === debits;
  const balanced = opening != null && closing != null && opening + credits - debits === closing;

  return {
    rows,
    openingPaise: opening,
    closingPaise: closing,
    unreadable,
    totalsMatch,
    complete: balanced && unreadable.length === 0 && totalsMatch !== false,
    maskedAccount: masked,
  };
}
