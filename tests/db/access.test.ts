import { beforeAll, describe, expect, it } from 'vitest';
import {
  admin, billRow, insertBill, must, newDevice, setDeviceStatus, seedShop, signedOut, type Device, type Shop,
} from './helpers';

let shop: Shop;
let approved: Device;

beforeAll(async () => {
  [shop, approved] = await Promise.all([seedShop(), newDevice()]);
});

describe('device access', () => {
  it('a signed-out visitor cannot read anything', async () => {
    const { data, error } = await signedOut().from('items').select('id');
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it('a pending phone cannot read or write', async () => {
    const pending = await newDevice('pending');
    expect(must(await pending.client.from('items').select('id'))).toEqual([]);
    const { error } = await pending.client.from('bills').insert(billRow(pending, shop, 100));
    expect(error?.code).toBe('42501');
  });

  it('a revoked phone loses read and write access at once', async () => {
    const phone = await newDevice();
    await insertBill(phone, shop, 100);
    expect(must(await phone.client.from('items').select('id')).length).toBeGreaterThan(0);

    await setDeviceStatus(phone.deviceId, 'revoked');
    expect(must(await phone.client.from('items').select('id'))).toEqual([]);
    expect(must(await phone.client.from('bills').select('id'))).toEqual([]);
    const { error } = await phone.client.from('bills').insert(billRow(phone, shop, 100));
    expect(error?.code).toBe('42501');
  });

  it('a phone cannot write as another phone', async () => {
    const other = await newDevice();
    const { error } = await approved.client.from('bills').insert(billRow(other, shop, 100));
    expect(error?.code).toBe('42501');
  });

  it('a phone cannot add lines or payments to another phone’s bill', async () => {
    const other = await newDevice();
    const bill = await insertBill(other, shop, 100);
    const line = await approved.client.from('bill_lines').insert({
      id: crypto.randomUUID(), device_id: approved.deviceId, bill_id: bill.id, item_id: shop.itemId,
      name: 'x', qty: 1, unit_price_paise: 100, line_total_paise: 100, created_at: new Date().toISOString(),
    });
    expect(line.error?.code).toBe('42501');
  });

  it('a phone sees only its own device row', async () => {
    await newDevice();
    const rows = must(await approved.client.from('devices').select('id'));
    expect(rows).toEqual([{ id: approved.deviceId }]);
  });

  it('a phone cannot approve itself', async () => {
    const pending = await newDevice('pending');
    await pending.client.from('devices').update({ status: 'approved', code: 'ZZ9' }).eq('id', pending.deviceId);
    const row = must(await admin.from('devices').select('status').eq('id', pending.deviceId).single());
    expect(row.status).toBe('pending');
  });

  it('a phone cannot register itself as approved', async () => {
    const client = signedOut();
    const user = must(await client.auth.signInAnonymously()).user;
    const { error } = await client.from('devices').insert({
      id: crypto.randomUUID(), auth_user_id: user?.id, name: 'sneaky', status: 'approved', code: 'ZZ8',
      created_at: new Date().toISOString(),
    });
    expect(error?.code).toBe('42501');
  });
});
