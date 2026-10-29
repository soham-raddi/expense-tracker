import { isLockSuspended, keepUnlockedDuring } from '../lockGuard';

describe('lockGuard', () => {
  test('is not suspended by default', () => {
    expect(isLockSuspended(Date.now() + 10_000)).toBe(false);
  });

  test('is suspended while a dialog is open and for a moment afterwards', async () => {
    let during = false;
    await keepUnlockedDuring(async () => {
      during = isLockSuspended();
    });
    expect(during).toBe(true);
    expect(isLockSuspended()).toBe(true); // just ended
    expect(isLockSuspended(Date.now() + 5_000)).toBe(false); // settled
  });

  test('stays suspended until every overlapping dialog has finished', async () => {
    let releaseFirst: () => void = () => {};
    const first = keepUnlockedDuring(() => new Promise<void>(resolve => (releaseFirst = resolve)));
    await keepUnlockedDuring(async () => {});
    expect(isLockSuspended(Date.now() + 60_000)).toBe(true);
    releaseFirst();
    await first;
    expect(isLockSuspended(Date.now() + 60_000)).toBe(false);
  });

  test('passes the result through and rethrows errors', async () => {
    await expect(keepUnlockedDuring(async () => 42)).resolves.toBe(42);
    await expect(
      keepUnlockedDuring(async () => {
        throw new Error('denied');
      }),
    ).rejects.toThrow('denied');
    expect(isLockSuspended(Date.now() + 60_000)).toBe(false);
  });
});
