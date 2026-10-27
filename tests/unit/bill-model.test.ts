import { describe, expect, it } from 'vitest';
import {
  ONE, addItem, billRecords, billTotal, draftLineTotal, emptyBill, formatQty, isPriceChanged, lineTotal,
  parseQty, removeLine, setLinePrice, setQty, snapshotName,
} from '../../src/bill';
import type { ItemRow } from '../../src/db';
import type { StaffMember } from '../../src/staff/types';

const stamp = { device_id: 'd', staff_id: 's', created_at: '2026-10-27T00:00:00Z', server_at: 'x' };
const item = (id: string, extra: Partial<ItemRow> = {}): ItemRow => ({
  ...stamp, id, company_id: 'c1', name_hi: '', name_en: id, size: '', unit: 'piece', price_paise: 100,
  category: '', picture: null, needs_review: false, archived: false, ...extra,
});
const cement = item('cement', { name_hi: 'सीमेंट', name_en: 'Cement', size: '50kg', unit: 'bag', price_paise: 38_000 });
const nails = item('nails', { name_hi: 'कील', name_en: 'Nails', size: '2 inch', unit: 'kg', price_paise: 8_050 });
const ramesh: StaffMember = { id: 'staff-ramesh', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };

describe('quantity (M2-1)', () => {
  it.each([
    ['1', 1000], ['2.5', 2500], ['0.125', 125], ['10', 10_000], [' 3 ', 3000],
  ])('reads "%s" as %i thousandths', (text, milli) => {
    expect(parseQty(text)).toBe(milli);
  });

  it.each(['', '0', '0.000', '-1', '1.2345', 'abc', '1e3', '.5'])('refuses "%s"', (text) => {
    expect(parseQty(text)).toBeNull();
  });

  it('shows thousandths without trailing zeros', () => {
    expect(formatQty(2500)).toBe('2.5');
    expect(formatQty(3000)).toBe('3');
    expect(formatQty(125)).toBe('0.125');
    expect(formatQty(1010)).toBe('1.01');
  });
});

describe('line totals in whole paise (M2-1)', () => {
  it('multiplies with integers only', () => {
    expect(lineTotal(38_000, 2 * ONE)).toBe(76_000);
    expect(lineTotal(8_050, 2500)).toBe(20_125);
    expect(lineTotal(1_000, 125)).toBe(125);
  });

  it('rounds half a paisa up, and less than half down', () => {
    expect(lineTotal(333, 1500)).toBe(500); // 499.5 → 500
    expect(lineTotal(333, 1001)).toBe(333); // 333.333 → 333
    expect(lineTotal(1, 500)).toBe(1); // 0.5 → 1
    expect(lineTotal(1, 499)).toBe(0);
  });

  it('rounds away from zero for return quantities', () => {
    expect(lineTotal(333, -1500)).toBe(-500);
  });

  it('refuses totals too large to count exactly', () => {
    expect(() => lineTotal(Number.MAX_SAFE_INTEGER, 2 * ONE)).toThrow();
  });
});

describe('draft bill (M2-1)', () => {
  it('copies the item name (Hindi first, with size) and price when added', () => {
    const bill = addItem(emptyBill(), cement);
    expect(bill.lines).toMatchObject([
      { item_id: 'cement', name: 'सीमेंट 50kg', unit: 'bag', unit_price_paise: 38_000, default_price_paise: 38_000, qty_milli: ONE },
    ]);
    expect(snapshotName({ name_hi: '', name_en: 'Rod', size: '' })).toBe('Rod');
  });

  it('later changes to the item never change a line already on the bill', () => {
    const bill = addItem(emptyBill(), cement);
    const renamed = { ...cement, name_hi: 'नया नाम', price_paise: 50_000 };
    expect(bill.lines[0]).toMatchObject({ name: 'सीमेंट 50kg', unit_price_paise: 38_000 });
    expect(addItem(bill, renamed).lines[0]).toMatchObject({ name: 'सीमेंट 50kg', unit_price_paise: 38_000, qty_milli: 2 * ONE });
  });

  it('tapping the same item again adds one more instead of a new line', () => {
    let bill = addItem(emptyBill(), cement);
    bill = addItem(bill, nails);
    bill = addItem(bill, cement);
    expect(bill.lines.map((l) => [l.item_id, l.qty_milli])).toEqual([['cement', 2000], ['nails', 1000]]);
  });

  it('totals the bill from the lines', () => {
    let bill = addItem(addItem(emptyBill(), cement), nails);
    const nailsLine = bill.lines[1];
    if (!nailsLine) throw new Error('missing line');
    bill = setQty(bill, nailsLine.id, 2500);
    expect(draftLineTotal(bill.lines[1] ?? nailsLine)).toBe(20_125);
    expect(billTotal(bill)).toBe(38_000 + 20_125);
    expect(billTotal(emptyBill())).toBe(0);
  });

  it('a price changed for this sale only is marked, and the item is untouched', () => {
    let bill = addItem(emptyBill(), cement);
    const line = bill.lines[0];
    if (!line) throw new Error('missing line');
    bill = setLinePrice(bill, line.id, 37_500);
    expect(bill.lines[0]).toMatchObject({ unit_price_paise: 37_500, default_price_paise: 38_000 });
    expect(isPriceChanged(bill.lines[0] ?? line)).toBe(true);
    expect(cement.price_paise).toBe(38_000);
    expect(billTotal(bill)).toBe(37_500);
  });

  it('removes a line, and never changes the bill it was given', () => {
    const one = addItem(emptyBill(), cement);
    const two = addItem(one, nails);
    const line = two.lines[0];
    if (!line) throw new Error('missing line');
    expect(removeLine(two, line.id).lines.map((l) => l.item_id)).toEqual(['nails']);
    expect(two.lines).toHaveLength(2);
    expect(one.lines).toHaveLength(1);
  });

  it('refuses a zero or bad quantity or price, and unknown lines', () => {
    const bill = addItem(emptyBill(), cement);
    const id = bill.lines[0]?.id ?? '';
    expect(() => setQty(bill, id, 0)).toThrow();
    expect(() => setQty(bill, id, 1.5)).toThrow();
    expect(() => setLinePrice(bill, id, -1)).toThrow();
    expect(() => setLinePrice(bill, id, 10.5)).toThrow();
    expect(() => setQty(bill, 'nope', 1000)).toThrow();
  });
});

describe('bill records (M2-1)', () => {
  it('makes a bill and its lines with snapshots, phone-made UUIDs and a total that adds up', () => {
    let draft = addItem(addItem(emptyBill(), cement), nails);
    draft = setQty(draft, draft.lines[1]?.id ?? '', 2500);
    const now = new Date('2026-10-27T05:00:00Z');
    const { bill, lines } = billRecords(draft, { staff: ramesh, deviceId: 'device-1' }, 'A-261027-001', now);

    expect(bill).toMatchObject({
      bill_no: 'A-261027-001', staff_id: 'staff-ramesh', device_id: 'device-1', customer_id: null,
      kind: 'sale', linked_bill_id: null, total_paise: 58_125, created_at: '2026-10-27T05:00:00.000Z', server_at: null,
    });
    expect(lines).toMatchObject([
      { bill_id: bill.id, item_id: 'cement', name: 'सीमेंट 50kg', qty_milli: 1000, unit_price_paise: 38_000, line_total_paise: 38_000 },
      { bill_id: bill.id, item_id: 'nails', name: 'कील 2 inch', qty_milli: 2500, unit_price_paise: 8_050, line_total_paise: 20_125 },
    ]);
    expect(lines.reduce((sum, l) => sum + l.line_total_paise, 0)).toBe(bill.total_paise);
    const ids = [bill.id, ...lines.map((l) => l.id)];
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(lines.map((l) => l.id)).not.toContain(draft.lines[0]?.id);
  });

  it('refuses an empty bill, and a bill with no staff member unlocked', () => {
    expect(() => billRecords(emptyBill(), { staff: ramesh, deviceId: 'device-1' }, 'A-1')).toThrow();
    expect(() => billRecords(addItem(emptyBill(), cement), { staff: null, deviceId: 'device-1' }, 'A-1')).toThrow();
  });
});
