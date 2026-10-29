// Small helpers shared by bank parsers.

/** "1,234.5" -> 123450. Works on the string so no float rounding errors. */
export function rupeesToPaise(amount: string): number {
  const clean = amount.replace(/,/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) {
    throw new Error('Invalid amount');
  }
  const rupees = Number(match[1]);
  const paise = Number((match[2] ?? '').padEnd(2, '0'));
  return rupees * 100 + paise;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "28-Oct-26" -> epoch ms of midnight IST on that date, or null if not a date. */
export function parseDdMonYy(date: string): number | null {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/.exec(date);
  if (!match) {
    return null;
  }
  const month = MONTHS.indexOf(match[2].toLowerCase());
  if (month < 0) {
    return null;
  }
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  return Date.UTC(year, month, Number(match[1])) - IST_OFFSET_MS;
}

/**
 * Bank SMS usually give only a date. Use the time the phone received the SMS,
 * unless that is more than a day away from the stated date (a delayed SMS),
 * in which case use the stated date.
 */
export function pickTimestamp(statedDate: number | null, receivedAt: number): number {
  if (statedDate == null) {
    return receivedAt;
  }
  const diff = receivedAt - statedDate;
  return diff >= 0 && diff < 2 * DAY_MS ? receivedAt : statedDate;
}
