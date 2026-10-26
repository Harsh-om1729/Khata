import { beforeAll, describe, expect, it } from 'vitest';
import {
  admin, id, insertBill, must, mustOk, newDevice, newOwner, now, paymentRow, seedShop,
  type Device, type Shop,
} from './helpers';

let phone: Device;
let owner: Device;
let shop: Shop;
let billId: string;
let lineId: string;
let paymentId: string;

beforeAll(async () => {
  [phone, owner, shop] = await Promise.all([newDevice(), newOwner(), seedShop()]);
  const bill = await insertBill(phone, shop, 84_000);
  billId = bill.id;
  lineId = id();
  paymentId = id();
  mustOk(await phone.client.from('bill_lines').insert({
    id: lineId, device_id: phone.deviceId, bill_id: billId, item_id: shop.itemId, name: 'Cement 50kg',
    qty: 2, unit_price_paise: 42_000, line_total_paise: 84_000, created_at: now(),
  }));
  mustOk(await phone.client.from('payments').insert(
    paymentRow(phone, shop, { id: paymentId, bill_id: billId, method: 'cash', type: 'sale', amount_paise: 84_000 }),
  ));
});

const records = [
  { table: 'bills', rowId: () => billId, change: { total_paise: 1 } },
  { table: 'bill_lines', rowId: () => lineId, change: { line_total_paise: 1 } },
  { table: 'payments', rowId: () => paymentId, change: { amount_paise: 1 } },
] as const;

async function snapshot(table: string, rowId: string): Promise<unknown> {
  return must(await admin.from(table).select('*').eq('id', rowId).single());
}

describe.each(records)('$table is append-only', ({ table, rowId, change }) => {
  it('a staff phone cannot update it', async () => {
    const before = await snapshot(table, rowId());
    const { error } = await phone.client.from(table).update(change).eq('id', rowId());
    expect(error).not.toBeNull();
    expect(await snapshot(table, rowId())).toEqual(before);
  });

  it('a staff phone cannot delete it', async () => {
    const { error } = await phone.client.from(table).delete().eq('id', rowId());
    expect(error).not.toBeNull();
    expect(await snapshot(table, rowId())).toBeTruthy();
  });

  it('the owner cannot update or delete it either', async () => {
    const before = await snapshot(table, rowId());
    expect((await owner.client.from(table).update(change).eq('id', rowId())).error).not.toBeNull();
    expect((await owner.client.from(table).delete().eq('id', rowId())).error).not.toBeNull();
    expect(await snapshot(table, rowId())).toEqual(before);
  });

  it('even the service key cannot change it', async () => {
    const before = await snapshot(table, rowId());
    const updated = await admin.from(table).update(change).eq('id', rowId());
    expect(updated.error?.message).toContain('append-only');
    const deleted = await admin.from(table).delete().eq('id', rowId());
    expect(deleted.error?.message).toContain('append-only');
    expect(await snapshot(table, rowId())).toEqual(before);
  });
});

describe('safe retries and server time', () => {
  it('sending the same bill twice stores it once', async () => {
    const bill = { id: id(), device_id: phone.deviceId, bill_no: `R-${id().slice(0, 8)}`, staff_id: shop.staffId, total_paise: 500, created_at: now() };
    for (let i = 0; i < 2; i++) {
      mustOk(await phone.client.from('bills').upsert(bill, { onConflict: 'id', ignoreDuplicates: true }));
    }
    const rows = must(await admin.from('bills').select('id').eq('id', bill.id));
    expect(rows).toHaveLength(1);
  });

  it('a phone cannot reuse its own bill number', async () => {
    const first = await insertBill(phone, shop, 100);
    const { error } = await phone.client.from('bills').insert({ ...first, id: id() });
    expect(error?.code).toBe('23505');
  });

  it('server_at is the server clock, not the phone clock', async () => {
    const billIdForClock = id();
    mustOk(await phone.client.from('bills').insert({
      id: billIdForClock, device_id: phone.deviceId, bill_no: `C-${id().slice(0, 8)}`, staff_id: shop.staffId,
      total_paise: 100, created_at: '2020-01-01T00:00:00Z', server_at: '2020-01-01T00:00:00Z',
    }));
    const row = must(await admin.from('bills').select('created_at, server_at').eq('id', billIdForClock).single());
    expect(new Date(row.created_at).getUTCFullYear()).toBe(2020);
    expect(Math.abs(Date.now() - new Date(row.server_at).getTime())).toBeLessThan(60_000);
  });
});
