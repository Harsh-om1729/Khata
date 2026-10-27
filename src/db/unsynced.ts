import type { KhataDb } from './schema';

/** Bills older than this that are still only on the phone get a warning. The spec says "old"; 4 hours is a shop half-day. */
export const OLD_UNSYNCED_MS = 4 * 60 * 60 * 1000;

export interface Unsynced {
  count: number;
  /** When the oldest bill still waiting was saved, or null when none is waiting. */
  oldest: string | null;
}

/** Bills still waiting in the outbox, i.e. not yet in the cloud. */
export async function unsyncedBills(db: KhataDb): Promise<Unsynced> {
  const waiting = await db.outbox.where('table').equals('bills').toArray();
  const oldest = waiting.reduce<string | null>((min, e) => (min === null || e.queued_at < min ? e.queued_at : min), null);
  return { count: waiting.length, oldest };
}

export function isOld(unsynced: Unsynced, now: number): boolean {
  return unsynced.oldest !== null && now - new Date(unsynced.oldest).getTime() >= OLD_UNSYNCED_MS;
}
