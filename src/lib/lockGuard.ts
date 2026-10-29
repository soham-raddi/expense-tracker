// System dialogs the app opens itself (such as the SMS permission request) push it to the
// background for a moment. The app lock must not treat that as "the user left the app".

const SETTLE_MS = 1500;

let running = 0;
let endedAt = 0;

/** Runs a system dialog without the app locking itself while it is on screen. */
export async function keepUnlockedDuring<T>(task: () => Promise<T>): Promise<T> {
  running++;
  try {
    return await task();
  } finally {
    running--;
    endedAt = Date.now();
  }
}

/** True while such a dialog is open, and briefly after, while Android reports the app active again. */
export function isLockSuspended(now: number = Date.now()): boolean {
  return running > 0 || now - endedAt < SETTLE_MS;
}
