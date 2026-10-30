// Filtering and sorting the payments list. Pure logic, so it is easy to test.

export type DirectionFilter = 'ALL' | 'DEBIT' | 'CREDIT';
export type SortKey = 'NEWEST' | 'OLDEST' | 'LARGEST' | 'SMALLEST';

export interface TxnFilters {
  direction: DirectionFilter;
  /** null = any group; { id: null } = payments that are not in a group yet. */
  group: { id: number | null } | null;
  minPaise: number | null;
  maxPaise: number | null;
  mode: string | null; // e.g. 'UPI', 'CARD'
  search: string;
  sort: SortKey;
  allTime: boolean; // false = only the month shown on Home
}

export const NO_FILTERS: TxnFilters = {
  direction: 'ALL',
  group: null,
  minPaise: null,
  maxPaise: null,
  mode: null,
  search: '',
  sort: 'NEWEST',
  allTime: false,
};

export interface FilterableTxn {
  amountPaise: number;
  direction: string;
  timestamp: number;
  mode: string;
  categoryId: number | null;
  categoryName: string | null;
  payeeName: string | null;
  payeeOriginalName: string | null;
  note: string | null;
}

/** "1,000" or "1000.50" -> paise. Empty or not a number -> null. */
export function parseRupeesInput(text: string): number | null {
  const clean = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
    return null;
  }
  const [rupees, fraction = ''] = clean.split('.');
  return Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
}

function matchesSearch(t: FilterableTxn, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (q === '') {
    return true;
  }
  return [t.payeeName, t.payeeOriginalName, t.note, t.categoryName, t.mode].some(
    field => field != null && field.toLowerCase().includes(q),
  );
}

export function matchesFilters(t: FilterableTxn, f: TxnFilters): boolean {
  if (f.direction !== 'ALL' && t.direction !== f.direction) {
    return false;
  }
  if (f.group && t.categoryId !== f.group.id) {
    return false;
  }
  if (f.minPaise != null && t.amountPaise < f.minPaise) {
    return false;
  }
  if (f.maxPaise != null && t.amountPaise > f.maxPaise) {
    return false;
  }
  if (f.mode != null && t.mode !== f.mode) {
    return false;
  }
  return matchesSearch(t, f.search);
}

export function sortTxns<T extends FilterableTxn>(rows: T[], sort: SortKey): T[] {
  const sorted = [...rows];
  switch (sort) {
    case 'NEWEST':
      return sorted.sort((a, b) => b.timestamp - a.timestamp);
    case 'OLDEST':
      return sorted.sort((a, b) => a.timestamp - b.timestamp);
    case 'LARGEST':
      return sorted.sort((a, b) => b.amountPaise - a.amountPaise || b.timestamp - a.timestamp);
    case 'SMALLEST':
      return sorted.sort((a, b) => a.amountPaise - b.amountPaise || b.timestamp - a.timestamp);
  }
}

export function applyFilters<T extends FilterableTxn>(rows: T[], f: TxnFilters): T[] {
  return sortTxns(
    rows.filter(t => matchesFilters(t, f)),
    f.sort,
  );
}

/** True for sorts where grouping the list by day would make no sense. */
export function isAmountSort(sort: SortKey): boolean {
  return sort === 'LARGEST' || sort === 'SMALLEST';
}

/** How many filters narrow the list (sort and time scope are shown separately). */
export function narrowingCount(f: TxnFilters): number {
  return [
    f.direction !== 'ALL',
    f.group != null,
    f.minPaise != null || f.maxPaise != null,
    f.mode != null,
    f.search.trim() !== '',
  ].filter(Boolean).length;
}

export function isDefault(f: TxnFilters): boolean {
  return narrowingCount(f) === 0 && f.sort === NO_FILTERS.sort && !f.allTime;
}

export const SORT_LABEL: Record<SortKey, string> = {
  NEWEST: 'Newest first',
  OLDEST: 'Oldest first',
  LARGEST: 'Largest first',
  SMALLEST: 'Smallest first',
};
