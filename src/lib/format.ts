// Pure display helpers (money, dates, grouping). No React, so they are easy to test.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** 125050 -> "1,250.50". Indian digit grouping (1,00,000). */
export function formatAmount(paise: number, alwaysDecimals = true): string {
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  const digits = String(rupees);
  const last3 = digits.slice(-3);
  const head = digits.slice(0, -3);
  const grouped = head ? `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  const withDecimals = alwaysDecimals || rest !== 0;
  return withDecimals ? `${grouped}.${String(rest).padStart(2, '0')}` : grouped;
}

export function formatRupees(paise: number, alwaysDecimals = true): string {
  return `${paise < 0 ? '−' : ''}₹${formatAmount(paise, alwaysDecimals)}`;
}

export interface MonthRef {
  year: number;
  month: number; // 0-11
}

export function monthOf(timestamp: number): MonthRef {
  const d = new Date(timestamp);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function addMonths(m: MonthRef, delta: number): MonthRef {
  const index = m.year * 12 + m.month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

export function sameMonth(a: MonthRef, b: MonthRef): boolean {
  return a.year === b.year && a.month === b.month;
}

/** Local-time bounds [start, end) of a month. */
export function monthBounds(m: MonthRef): { start: number; end: number } {
  const next = addMonths(m, 1);
  return {
    start: new Date(m.year, m.month, 1).getTime(),
    end: new Date(next.year, next.month, 1).getTime(),
  };
}

export function monthLabel(m: MonthRef): string {
  return `${MONTHS[m.month]} ${m.year}`;
}

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Yesterday", or "Wed, 28 Oct". */
export function dayLabel(timestamp: number, now: number): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS);
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  const d = new Date(timestamp);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** "9:23 pm". A statement-only row has midnight as its time, which is shown as no time. */
export function timeLabel(timestamp: number): string | null {
  const d = new Date(timestamp);
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    return null;
  }
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export function dateTimeLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const date = `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  const time = timeLabel(timestamp);
  return time ? `${date}, ${time}` : date;
}

export interface DaySection<T> {
  key: string;
  title: string;
  totalPaise: number; // debits minus credits for the day, negative = money out
  data: T[];
}

/** Groups newest-first items into one section per calendar day. */
export function groupByDay<T extends { timestamp: number; amountPaise: number; direction: string }>(
  items: T[],
  now: number,
): DaySection<T>[] {
  const sections: DaySection<T>[] = [];
  for (const item of items) {
    const key = String(startOfDay(item.timestamp));
    let section = sections[sections.length - 1];
    if (!section || section.key !== key) {
      section = { key, title: dayLabel(item.timestamp, now), totalPaise: 0, data: [] };
      sections.push(section);
    }
    section.data.push(item);
    section.totalPaise += item.direction === 'CREDIT' ? item.amountPaise : -item.amountPaise;
  }
  return sections;
}

/** Two-letter avatar text from a payee name: "Test Payee One" -> "TP". */
export function initials(name: string | null): string {
  if (!name) {
    return '?';
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  const first = words[0][0];
  const second = words.length > 1 ? words[1][0] : '';
  return (first + second).toUpperCase();
}

const MODE_LABELS: Record<string, string> = {
  UPI: 'UPI',
  CARD: 'Card',
  NEFT: 'NEFT',
  IMPS: 'IMPS',
  ATM: 'ATM',
  AUTOPAY: 'AutoPay',
  OTHER: 'Other',
};

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}
