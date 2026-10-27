import type { KhataDb } from '../db';

const CODE = /^[A-Z][A-Z0-9]{0,2}$/; // same rule as devices.code on the server

export class NoBillLetterError extends Error {
  constructor() {
    super('this phone has no bill letter yet');
    this.name = 'NoBillLetterError';
  }
}

/** "261027" for 27 Oct 2026, from the phone's own date. */
export function billDay(now: Date): string {
  return [now.getFullYear() % 100, now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('');
}

/** A-261027-007. The phone's bill letter is unique and never reused, so two phones can never make the same number. */
export function formatBillNo(code: string, day: string, n: number): string {
  return `${code}-${day}-${String(n).padStart(3, '0')}`;
}

/**
 * Takes the next bill number for this phone and day. Call it inside the transaction that saves the
 * bill, so a failed save gives the number back. Counters are never reset, so even if the phone's
 * clock goes back to an earlier day, numbering carries on instead of repeating.
 */
export async function nextBillNo(db: KhataDb, code: string | null, now = new Date()): Promise<string> {
  if (!code || !CODE.test(code)) throw new NoBillLetterError();
  const day = billDay(now);
  return db.transaction('rw', db.bill_counters, async () => {
    const n = ((await db.bill_counters.get(day))?.last ?? 0) + 1;
    await db.bill_counters.put({ day, last: n });
    return formatBillNo(code, day, n);
  });
}
