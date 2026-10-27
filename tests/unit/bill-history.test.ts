import { afterEach, describe, expect, it } from 'vitest';
import { addItem, emptyBill, saveCashBill, type DraftBill } from '../../src/bill';
import { KhataDb, createCompany, createItem, type Author, type ItemRow } from '../../src/db';
import { billDetail, recentBills } from '../../src/db/bills';
import type { StaffMember } from '../../src/staff/types';

const ramesh: StaffMember = { id: 'staff-ramesh', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };
const author: Author = { staff: ramesh, deviceId: 'device-1' };

const opened: KhataDb[] = [];
async function shopWith(count: number) {
  const db = new KhataDb(`test-${crypto.randomUUID()}`);
  opened.push(db);
  const company = await createCompany(db, author, { name: 'Ultratech' });
  const items: ItemRow[] = [];
  for (let i = 0; i < count; i++) {
    items.push(await createItem(db, author, { company_id: company.id, name_en: `Item ${String(i).padStart(2, '0')}`, price_paise: 100 * (i + 1) }));
  }
  return { db, items };
}
afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

describe('bill history (M2-8)', () => {
  it('lists this phone\'s bills newest first, with how they were paid', async () => {
    const { db, items } = await shopWith(2);
    const [a, b] = items as [ItemRow, ItemRow];
    const first = await saveCashBill(db, author, 'A', addItem(emptyBill(), a), new Date(2026, 9, 27, 10, 0));
    const second = await saveCashBill(db, author, 'A', addItem(emptyBill(), b), new Date(2026, 9, 27, 11, 0));
    const list = await recentBills(db);
    expect(list.map((s) => s.bill.bill_no)).toEqual([second.bill.bill_no, first.bill.bill_no]);
    expect(list[0]?.methods).toEqual(['cash']);
  });

  it('keeps only the latest bills when asked for a limit', async () => {
    const { db, items } = await shopWith(1);
    for (let h = 8; h < 13; h++) await saveCashBill(db, author, 'A', addItem(emptyBill(), items[0] as ItemRow), new Date(2026, 9, 27, h));
    expect((await recentBills(db, 3)).map((s) => s.bill.bill_no)).toEqual(['A-261027-005', 'A-261027-004', 'A-261027-003']);
  });

  it('a bill shows its lines in the order they were added', async () => {
    const { db, items } = await shopWith(12);
    const order = [7, 2, 11, 0, 5, 9, 1, 3, 10, 4, 8, 6];
    let draft: DraftBill = emptyBill();
    for (const i of order) draft = addItem(draft, items[i] as ItemRow);
    const saved = await saveCashBill(db, author, 'A', draft);
    const detail = await billDetail(db, saved.bill.id);
    expect(detail?.lines.map((l) => l.name)).toEqual(order.map((i) => `Item ${String(i).padStart(2, '0')}`));
    expect(detail?.payments).toHaveLength(1);
  });

  it('an unknown bill is null', async () => {
    const { db } = await shopWith(0);
    expect(await billDetail(db, 'nope')).toBeNull();
  });
});
