import { afterEach, describe, expect, it } from 'vitest';
import { addItem, emptyBill, saveCashBill, setLinePrice, setQty, type DraftBill } from '../../src/bill';
import { KhataDb, createCompany, createItem, type Author, type ItemRow } from '../../src/db';
import type { StaffMember } from '../../src/staff/types';

const ramesh: StaffMember = { id: 'staff-ramesh', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };
const author: Author = { staff: ramesh, deviceId: 'device-1' };
const now = new Date(2026, 9, 27, 11, 30);

const opened: KhataDb[] = [];
async function shop() {
  const db = new KhataDb(`test-${crypto.randomUUID()}`);
  opened.push(db);
  const company = await createCompany(db, author, { name: 'Ultratech' });
  const cement = await createItem(db, author, { company_id: company.id, name_hi: 'सीमेंट', size: '50kg', unit: 'bag', price_paise: 38_000 });
  const nails = await createItem(db, author, { company_id: company.id, name_hi: 'कील', unit: 'kg', price_paise: 8_050 });
  await db.outbox.clear();
  return { db, cement, nails };
}
afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

function twoLineBill(cement: ItemRow, nails: ItemRow): DraftBill {
  let bill = addItem(addItem(addItem(emptyBill(), cement), cement), nails);
  bill = setQty(bill, bill.lines[1]?.id ?? '', 2500);
  return bill;
}

describe('saving a cash bill (M2-5)', () => {
  it('saves the bill, its lines and the cash payment with a bill number, all queued for the cloud', async () => {
    const { db, cement, nails } = await shop();
    const saved = await saveCashBill(db, author, 'A', twoLineBill(cement, nails), now);

    expect(saved.bill).toMatchObject({ bill_no: 'A-261027-001', total_paise: 96_125, staff_id: 'staff-ramesh', device_id: 'device-1', kind: 'sale' });
    expect(await db.bills.toArray()).toEqual([saved.bill]);
    expect(await db.bill_lines.where('bill_id').equals(saved.bill.id).count()).toBe(2);
    expect(await db.payments.toArray()).toMatchObject([
      { bill_id: saved.bill.id, method: 'cash', type: 'sale', amount_paise: 96_125, customer_id: null, staff_id: 'staff-ramesh' },
    ]);
    expect((await db.outbox.toArray()).map((e) => e.table)).toEqual(['bills', 'bill_lines', 'bill_lines', 'payments']);
  });

  it('keeps the price used in this sale on the line, not the item price', async () => {
    const { db, cement } = await shop();
    let bill = addItem(emptyBill(), cement);
    bill = setLinePrice(bill, bill.lines[0]?.id ?? '', 37_000);
    const saved = await saveCashBill(db, author, 'A', bill, now);
    expect(saved.lines[0]).toMatchObject({ unit_price_paise: 37_000, line_total_paise: 37_000, name: 'सीमेंट 50kg' });
    expect((await db.items.get(cement.id))?.price_paise).toBe(38_000);
  });

  it('numbers bills one after another', async () => {
    const { db, cement } = await shop();
    const one = await saveCashBill(db, author, 'A', addItem(emptyBill(), cement), now);
    const two = await saveCashBill(db, author, 'A', addItem(emptyBill(), cement), now);
    expect([one.bill.bill_no, two.bill.bill_no]).toEqual(['A-261027-001', 'A-261027-002']);
  });

  it('a ₹0 bill is saved without a payment, as the server refuses zero payments', async () => {
    const { db, cement } = await shop();
    let bill = addItem(emptyBill(), cement);
    bill = setLinePrice(bill, bill.lines[0]?.id ?? '', 0);
    const saved = await saveCashBill(db, author, 'A', bill, now);
    expect(saved.payment).toBeNull();
    expect(await db.payments.count()).toBe(0);
    expect(await db.bills.count()).toBe(1);
  });

  it.each(['bills', 'bill_lines', 'payments', 'outbox'] as const)(
    'done check: if writing %s fails part way, nothing of the bill is kept and its number is not used up',
    async (table) => {
      const { db, cement, nails } = await shop();
      const kill = () => {
        throw new Error('app killed');
      };
      db[table].hook('creating', kill);
      await expect(saveCashBill(db, author, 'A', twoLineBill(cement, nails), now)).rejects.toThrow();
      expect(await db.bills.count()).toBe(0);
      expect(await db.bill_lines.count()).toBe(0);
      expect(await db.payments.count()).toBe(0);
      expect(await db.outbox.count()).toBe(0);
      expect(await db.bill_counters.count()).toBe(0);

      db[table].hook('creating').unsubscribe(kill);
      expect((await saveCashBill(db, author, 'A', twoLineBill(cement, nails), now)).bill.bill_no).toBe('A-261027-001');
    },
  );

  it('refuses an empty bill, a phone with no bill letter, and no unlocked staff member, saving nothing', async () => {
    const { db, cement } = await shop();
    await expect(saveCashBill(db, author, 'A', emptyBill(), now)).rejects.toThrow();
    await expect(saveCashBill(db, author, null, addItem(emptyBill(), cement), now)).rejects.toThrow();
    await expect(saveCashBill(db, { staff: null, deviceId: 'device-1' }, 'A', addItem(emptyBill(), cement), now)).rejects.toThrow();
    expect(await db.bills.count()).toBe(0);
    expect(await db.bill_counters.count()).toBe(0);
  });

  it('a saved bill can never be overwritten', async () => {
    const { db, cement } = await shop();
    const saved = await saveCashBill(db, author, 'A', addItem(emptyBill(), cement), now);
    const { putWithOutbox } = await import('../../src/db');
    await expect(putWithOutbox(db, [{ table: 'bills', row: { ...saved.bill, total_paise: 1 } }])).rejects.toThrow();
    await expect(putWithOutbox(db, [{ table: 'bills', row: { ...saved.bill, id: crypto.randomUUID() } }])).rejects.toThrow();
    expect((await db.bills.get(saved.bill.id))?.total_paise).toBe(38_000);
  });
});
