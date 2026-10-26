import { readJson, type KeyValueStore } from './store';

export const MAX_WRONG_TRIES = 5;
export const LOCK_MS = 5 * 60_000;
const KEY = 'khata.pinLock';

interface LockState {
  failures: number;
  lockedUntil: number | null;
}

export interface PinLock {
  /** When the PIN screen unlocks again, or null if it is not locked. */
  lockedUntil(now: number): number | null;
  recordFailure(now: number): void;
  reset(): void;
}

// Saved on the phone so restarting the app does not clear the lock (PLAN §5).
export function createPinLock(store: KeyValueStore): PinLock {
  const read = (): LockState => {
    const raw = readJson(store, KEY);
    if (typeof raw !== 'object' || raw === null) return { failures: 0, lockedUntil: null };
    const v = raw as Record<string, unknown>;
    return {
      failures: typeof v.failures === 'number' ? v.failures : 0,
      lockedUntil: typeof v.lockedUntil === 'number' ? v.lockedUntil : null,
    };
  };
  const write = (state: LockState) => store.set(KEY, JSON.stringify(state));

  return {
    lockedUntil(now) {
      const { lockedUntil } = read();
      return lockedUntil !== null && lockedUntil > now ? lockedUntil : null;
    },
    recordFailure(now) {
      const state = read();
      const failures = (state.lockedUntil !== null && state.lockedUntil <= now ? 0 : state.failures) + 1;
      write(failures >= MAX_WRONG_TRIES ? { failures: 0, lockedUntil: now + LOCK_MS } : { failures, lockedUntil: null });
    },
    reset() {
      write({ failures: 0, lockedUntil: null });
    },
  };
}
