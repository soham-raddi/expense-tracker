import { importSince, SIX_MONTHS_MS } from '../importWindow';

const now = Date.parse('2026-10-30T12:00:00+05:30');

describe('importSince', () => {
  test('defaults to six months back', () => {
    expect(importSince(now, null)).toBe(now - SIX_MONTHS_MS);
  });

  test('a recent limit wins over six months', () => {
    const limit = now - 2 * 24 * 60 * 60 * 1000;
    expect(importSince(now, limit)).toBe(limit);
  });

  test('an old limit does not reach further back than six months', () => {
    expect(importSince(now, now - 2 * SIX_MONTHS_MS)).toBe(now - SIX_MONTHS_MS);
  });
});
