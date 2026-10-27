import { afterEach, describe, expect, it } from 'vitest';
import { billDay, formatBillNo, nextBillNo } from '../../src/bill';
import { KhataDb } from '../../src/db';

const opened: KhataDb[] = [];
function phone(name = `test-${crypto.randomUUID()}`) {
  const db = new KhataDb(name);
  opened.push(db);
  return db;
}
afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

const oct27 = new Date(2026, 9, 27, 10, 0);
const oct28 = new Date(2026, 9, 28, 9, 0);

describe('bill number format (M2-4)', () => {
  it('uses the phone letter, the local date and a 3-digit counter', () => {
    expect(billDay(oct27)).toBe('261027');
    expect(billDay(new Date(2027, 0, 5, 23, 59))).toBe('270105');
    expect(formatBillNo('A', '261027', 7)).toBe('A-261027-007');
    expect(formatBillNo('B2', '261027', 1000)).toBe('B2-261027-1000');
  });
});

describe('bill numbers per phone per day (M2-4)', () => {
  it('counts up on one phone and starts again at 001 the next day', async () => {
    const db = phone();
    expect(await nextBillNo(db, 'A', oct27)).toBe('A-261027-001');
    expect(await nextBillNo(db, 'A', oct27)).toBe('A-261027-002');
    expect(await nextBillNo(db, 'A', oct28)).toBe('A-261028-001');
  });

  it('never repeats a number when the phone clock goes back to an earlier day', async () => {
    const db = phone();
    await nextBillNo(db, 'A', oct27);
    await nextBillNo(db, 'A', oct27);
    await nextBillNo(db, 'A', oct28);
    expect(await nextBillNo(db, 'A', oct27)).toBe('A-261027-003');
  });

  it('carries on after the app is closed and opened again', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const first = phone(name);
    await nextBillNo(first, 'A', oct27);
    first.close();
    expect(await nextBillNo(phone(name), 'A', oct27)).toBe('A-261027-002');
  });

  it('many bills at once on one phone all get different numbers', async () => {
    const db = phone();
    const numbers = await Promise.all(Array.from({ length: 50 }, () => nextBillNo(db, 'A', oct27)));
    expect(new Set(numbers).size).toBe(50);
    expect(numbers.slice().sort()).toEqual(Array.from({ length: 50 }, (_, i) => formatBillNo('A', '261027', i + 1)));
  });

  it('done check: two phones billing offline on the same day never clash', async () => {
    const a = phone();
    const b = phone();
    const fromA: Promise<string>[] = [];
    const fromB: Promise<string>[] = [];
    for (let i = 0; i < 30; i++) {
      fromA.push(nextBillNo(a, 'A', oct27));
      fromB.push(nextBillNo(b, 'B', oct27));
    }
    const all = [...(await Promise.all(fromA)), ...(await Promise.all(fromB))];
    expect(new Set(all).size).toBe(60);
    expect(all.filter((n) => n.startsWith('A-'))).toHaveLength(30);
    expect(all.filter((n) => n.startsWith('B-'))).toHaveLength(30);
  });

  it('a save that fails gives its number back', async () => {
    const db = phone();
    await expect(
      db.transaction('rw', db.bill_counters, async () => {
        await nextBillNo(db, 'A', oct27);
        throw new Error('save failed');
      }),
    ).rejects.toThrow('save failed');
    expect(await nextBillNo(db, 'A', oct27)).toBe('A-261027-001');
  });

  it('refuses a phone with no bill letter, or a letter the server would refuse', async () => {
    const db = phone();
    await expect(nextBillNo(db, null, oct27)).rejects.toThrow();
    await expect(nextBillNo(db, '', oct27)).rejects.toThrow();
    await expect(nextBillNo(db, 'A-1', oct27)).rejects.toThrow();
    await expect(nextBillNo(db, 'abc', oct27)).rejects.toThrow();
    expect(await db.bill_counters.count()).toBe(0);
  });
});
