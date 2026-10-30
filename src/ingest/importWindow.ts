// Which messages an inbox import should read: the last six months, but nothing before a limit
// you set (for example after deleting all your data, so old messages do not come back).

export const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

export function importSince(now: number, limit: number | null): number {
  return Math.max(now - SIX_MONTHS_MS, limit ?? 0);
}
