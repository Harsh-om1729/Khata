import { beforeAll, describe, expect, it } from 'vitest';
import { admin, id, must, mustOk, newDevice, newOwner, now, seedShop, type Device, type Shop } from './helpers';

let phone: Device;
let owner: Device;
let shop: Shop;

beforeAll(async () => {
  [phone, owner, shop] = await Promise.all([newDevice(), newOwner(), seedShop()]);
});

function change(device: Device, field: string, value: string | null, changeId = id()) {
  return {
    id: changeId, device_id: device.deviceId, staff_id: shop.staffId, field, new_value: value, created_at: now(),
  };
}

async function settings() {
  return must(await admin.from('settings').select('shop_name, gstin, upi_qr, overdue_days').single());
}

describe('settings: everyone except the UPI QR (SPEC §2.1)', () => {
  it('a staff phone changes the shop name, GSTIN and overdue days, and each change is logged', async () => {
    const changes = [
      change(phone, 'shop_name', 'Anand Hardware'),
      change(phone, 'gstin', '10AABCU9603R1ZX'),
      change(phone, 'overdue_days', '45'),
    ];
    for (const row of changes) mustOk(await phone.client.from('settings_changes').insert(row));

    expect(await settings()).toMatchObject({ shop_name: 'Anand Hardware', gstin: '10AABCU9603R1ZX', overdue_days: 45 });
    const logged = must(await admin.from('settings_changes').select('id, device_id, staff_id, new_value')
      .in('id', changes.map((c) => c.id)));
    expect(logged).toHaveLength(3);
    expect(logged.every((r) => r.device_id === phone.deviceId && r.staff_id === shop.staffId)).toBe(true);
  });

  it('the log keeps the old value', async () => {
    mustOk(await phone.client.from('settings_changes').insert(change(phone, 'overdue_days', '30')));
    const first = change(phone, 'overdue_days', '60');
    mustOk(await phone.client.from('settings_changes').insert(first));
    const row = must(await admin.from('settings_changes').select('old_value, new_value').eq('id', first.id).single());
    expect(row).toEqual({ old_value: '30', new_value: '60' });
  });

  it('GSTIN is optional, and an invalid one is rejected', async () => {
    const bad = await phone.client.from('settings_changes').insert(change(phone, 'gstin', 'NOT-A-GSTIN'));
    expect(bad.error?.code).toBe('23514');
    mustOk(await phone.client.from('settings_changes').insert(change(phone, 'gstin', '')));
    expect((await settings()).gstin).toBeNull();
  });

  it('a staff phone cannot change the UPI QR', async () => {
    const before = (await settings()).upi_qr;
    const { error } = await phone.client.from('settings_changes').insert(change(phone, 'upi_qr', 'qr/fake.png'));
    expect(error?.code).toBe('42501');
    expect((await settings()).upi_qr).toBe(before);
  });

  it('the owner changes the UPI QR, and it raises an alert everyone can see', async () => {
    const qr = change(owner, 'upi_qr', `qr/${id()}.png`);
    mustOk(await owner.client.from('settings_changes').insert(qr));
    expect((await settings()).upi_qr).toBe(qr.new_value);
    const alerts = must(await phone.client.from('alerts').select('type, ref_id').eq('ref_id', qr.id));
    expect(alerts).toEqual([{ type: 'upi_qr_change', ref_id: qr.id }]);
  });

  it('the owner can make a change from a staff phone, naming that approved phone', async () => {
    mustOk(await owner.client.from('settings_changes').insert(change(phone, 'shop_name', 'Owner on staff phone')));
    expect((await settings()).shop_name).toBe('Owner on staff phone');
  });

  it('the owner cannot name a phone that is not approved', async () => {
    const pending = await newDevice('pending');
    const { error } = await owner.client.from('settings_changes').insert(change(pending, 'shop_name', 'x'));
    expect(error?.code).toBe('42501');
  });

  it('resending the same change does not apply an old value again or alert twice', async () => {
    const qr = change(owner, 'upi_qr', `qr/${id()}.png`);
    mustOk(await owner.client.from('settings_changes').insert(qr));
    const newer = change(owner, 'upi_qr', `qr/${id()}.png`);
    mustOk(await owner.client.from('settings_changes').insert(newer));
    mustOk(await owner.client.from('settings_changes').upsert(qr, { onConflict: 'id', ignoreDuplicates: true }));

    expect((await settings()).upi_qr).toBe(newer.new_value);
    expect(must(await admin.from('alerts').select('id').eq('ref_id', qr.id))).toHaveLength(1);
  });

  it('settings and their log cannot be edited directly', async () => {
    expect((await phone.client.from('settings').update({ shop_name: 'direct' }).eq('id', true)).error).not.toBeNull();
    const logged = change(phone, 'shop_name', 'logged');
    mustOk(await phone.client.from('settings_changes').insert(logged));
    expect((await owner.client.from('settings_changes').delete().eq('id', logged.id)).error).not.toBeNull();
    const viaService = await admin.from('settings_changes').update({ new_value: 'x' }).eq('id', logged.id);
    expect(viaService.error?.message).toContain('append-only');
  });
});

describe('staff: owner-only management, PINs only through the server', () => {
  it('the owner adds a staff member; a staff phone cannot', async () => {
    const newStaff = id();
    mustOk(await owner.client.rpc('add_staff', { p_id: newStaff, p_name: 'Mohan', p_pin: '1234' }));
    expect(must(await phone.client.from('staff').select('name').eq('id', newStaff).single()).name).toBe('Mohan');

    const byPhone = await phone.client.rpc('add_staff', { p_id: id(), p_name: 'Sneaky', p_pin: '0000' });
    expect(byPhone.error?.code).toBe('42501');
    const direct = await phone.client.from('staff').insert({ id: id(), name: 'Direct', pin_hash: 'x', created_at: now() });
    expect(direct.error?.code).toBe('42501');
  });

  it('nobody can read pin_hash through the API, not even the owner', async () => {
    for (const client of [phone.client, owner.client]) {
      const { error } = await client.from('staff').select('pin_hash').limit(1);
      expect(error?.code).toBe('42501');
    }
  });

  it('only the owner can reset a PIN or remove a staff member', async () => {
    const staffId = id();
    mustOk(await owner.client.rpc('add_staff', { p_id: staffId, p_name: 'Raju', p_pin: '1111' }));

    expect((await phone.client.rpc('reset_staff_pin', { p_id: staffId, p_new_pin: '2222' })).error?.code).toBe('42501');
    expect((await phone.client.rpc('remove_staff', { p_id: staffId })).error?.code).toBe('42501');
    expect((await phone.client.from('staff').update({ name: 'x' }).eq('id', staffId)).error?.code).toBe('42501');

    mustOk(await owner.client.rpc('reset_staff_pin', { p_id: staffId, p_new_pin: '2222' }));
    expect(must(await phone.client.from('staff').select('pin_version').eq('id', staffId).single()).pin_version).toBe(2);

    mustOk(await owner.client.rpc('remove_staff', { p_id: staffId }));
    const removed = must(await phone.client.from('staff').select('active, removed_at').eq('id', staffId).single());
    expect(removed.active).toBe(false);
    expect(removed.removed_at).not.toBeNull();
  });

  it('a staff member changes their own PIN only with the right old PIN', async () => {
    const staffId = id();
    mustOk(await owner.client.rpc('add_staff', { p_id: staffId, p_name: 'Sita', p_pin: '4321' }));

    const wrong = await phone.client.rpc('change_own_pin', { p_id: staffId, p_old_pin: '0000', p_new_pin: '5555' });
    expect(wrong.error?.code).toBe('28P01');
    const badFormat = await phone.client.rpc('change_own_pin', { p_id: staffId, p_old_pin: '4321', p_new_pin: '12' });
    expect(badFormat.error?.code).toBe('22023');

    mustOk(await phone.client.rpc('change_own_pin', { p_id: staffId, p_old_pin: '4321', p_new_pin: '5555' }));
    expect(must(await phone.client.from('staff').select('pin_version').eq('id', staffId).single()).pin_version).toBe(2);
    // The old PIN no longer works; the new one does.
    expect((await phone.client.rpc('change_own_pin', { p_id: staffId, p_old_pin: '4321', p_new_pin: '6666' })).error?.code).toBe('28P01');
    mustOk(await phone.client.rpc('change_own_pin', { p_id: staffId, p_old_pin: '5555', p_new_pin: '6666' }));
  });

  it('a pending phone cannot change a PIN', async () => {
    const staffId = id();
    mustOk(await owner.client.rpc('add_staff', { p_id: staffId, p_name: 'Geeta', p_pin: '1212' }));
    const pending = await newDevice('pending');
    const { error } = await pending.client.rpc('change_own_pin', { p_id: staffId, p_old_pin: '1212', p_new_pin: '3434' });
    expect(error?.code).toBe('42501');
  });
});

describe('items and companies: archived, never deleted', () => {
  it('a staff phone archives and restores an item; nobody can delete it', async () => {
    const archive = await phone.client.from('items').update({ archived: true }).eq('id', shop.itemId).select('archived');
    expect(must(archive)).toEqual([{ archived: true }]);
    const restore = await phone.client.from('items').update({ archived: false }).eq('id', shop.itemId).select('archived');
    expect(must(restore)).toEqual([{ archived: false }]);

    for (const client of [phone.client, owner.client]) {
      expect((await client.from('items').delete().eq('id', shop.itemId)).error?.code).toBe('42501');
    }
    expect(must(await admin.from('items').select('id').eq('id', shop.itemId))).toHaveLength(1);
  });

  it('nobody can delete a company', async () => {
    const item = must(await admin.from('items').select('company_id').eq('id', shop.itemId).single());
    for (const client of [phone.client, owner.client]) {
      expect((await client.from('companies').delete().eq('id', item.company_id)).error?.code).toBe('42501');
    }
  });
});

describe('alerts are on the live dashboard (SPEC §6)', () => {
  it('a staff phone can read alerts but not mark them seen', async () => {
    const alertId = id();
    mustOk(await phone.client.from('alerts').insert({ id: alertId, device_id: phone.deviceId, type: 'void', created_at: now() }));
    expect(must(await phone.client.from('alerts').select('id').eq('id', alertId))).toHaveLength(1);
    const seen = await phone.client.from('alerts').update({ seen: true }).eq('id', alertId).select('id');
    expect(must(seen)).toEqual([]);
    mustOk(await owner.client.from('alerts').update({ seen: true }).eq('id', alertId));
  });
});

describe('editing items made by someone else (last write wins)', () => {
  it('a staff phone changes the price of an item it did not create, and cannot change its creator', async () => {
    const priced = await phone.client.from('items').update({ price_paise: 43_500 }).eq('id', shop.itemId).select('price_paise');
    expect(must(priced)).toEqual([{ price_paise: 43_500 }]);
    const creator = await phone.client.from('items').update({ device_id: phone.deviceId }).eq('id', shop.itemId);
    expect(creator.error?.code).toBe('42501');
  });
});

describe('shop profile fields (U-1)', () => {
  async function profile() {
    return must(await admin.from('settings').select('phone1, phone2, address, pincode, state').single());
  }

  it('a staff phone saves phones, address, pincode and state, and each change is logged', async () => {
    const changes = [
      change(phone, 'phone1', '9876543210'),
      change(phone, 'phone2', '6122345678'),
      change(phone, 'address', 'Main Road, Patna'),
      change(phone, 'pincode', '800001'),
      change(phone, 'state', '10'),
    ];
    for (const row of changes) mustOk(await phone.client.from('settings_changes').insert(row));
    expect(await profile()).toEqual({ phone1: '9876543210', phone2: '6122345678', address: 'Main Road, Patna', pincode: '800001', state: '10' });
    expect(must(await admin.from('settings_changes').select('id').in('id', changes.map((c) => c.id)))).toHaveLength(5);
  });

  it('an empty value clears a field', async () => {
    mustOk(await phone.client.from('settings_changes').insert(change(phone, 'phone2', '6122345678')));
    mustOk(await phone.client.from('settings_changes').insert(change(phone, 'phone2', null)));
    expect((await profile()).phone2).toBeNull();
  });

  it('rejects values the phone would never send', async () => {
    for (const [field, value] of [['phone1', '12345'], ['pincode', '080001'], ['state', 'BR'], ['address', 'a'.repeat(201)]] as const) {
      const { error } = await phone.client.from('settings_changes').insert(change(phone, field, value));
      expect(error?.code, field).toBe('23514');
    }
  });
});
