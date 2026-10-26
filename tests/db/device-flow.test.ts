import { describe, expect, it } from 'vitest';
import { createDeviceAdmin } from '../../src/auth/device-admin';
import { createDeviceRegistration, type KeyValueStore } from '../../src/sync/device-registration';
import { billRow, must, newDevice, newOwner, seedShop, signedOut } from './helpers';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
}

async function newPhone() {
  const client = signedOut();
  const store = memoryStore();
  const registration = createDeviceRegistration(() => Promise.resolve(client), store);
  return { client, store, registration };
}

describe('M0-6: a new phone is approved, then revoked and loses access', () => {
  it('runs the whole flow with the app code and real logins', async () => {
    const shop = await seedShop();
    const owner = await newOwner();
    const admin = createDeviceAdmin(() => Promise.resolve(owner.client));
    const phone = await newPhone();

    // 1. A new phone registers itself and waits.
    const registered = await phone.registration.refresh();
    expect(registered.status).toBe('pending');
    expect(phone.registration.cached()).toEqual(registered);
    expect(must(await phone.client.from('items').select('id'))).toEqual([]);

    // Registering again (e.g. app restart) reuses the same device row.
    expect((await phone.registration.refresh()).id).toBe(registered.id);

    // 2. The owner sees it and approves it; it gets a free bill letter.
    expect((await admin.list()).map((d) => d.id)).toContain(registered.id);
    await admin.approve(registered.id);
    const approved = await phone.registration.refresh();
    expect(approved.status).toBe('approved');
    expect(approved.code).toMatch(/^[A-Z][A-Z0-9]{0,2}$/);
    expect(must(await phone.client.from('items').select('id')).length).toBeGreaterThan(0);
    const bill = billRow({ client: phone.client, deviceId: registered.id }, shop, 100);
    expect((await phone.client.from('bills').insert(bill)).error).toBeNull();

    // 3. The owner revokes it: reads and writes stop at once, and the phone can see why.
    await admin.revoke(registered.id);
    expect((await phone.registration.refresh()).status).toBe('revoked');
    expect(must(await phone.client.from('items').select('id'))).toEqual([]);
    expect(must(await phone.client.from('bills').select('id'))).toEqual([]);
    const blocked = await phone.client.from('bills').insert(billRow({ client: phone.client, deviceId: registered.id }, shop, 100));
    expect(blocked.error?.code).toBe('42501');

    // 4. Approving again keeps the same bill letter.
    await admin.approve(registered.id);
    expect((await phone.registration.refresh()).code).toBe(approved.code);
  });

  it('two approved phones never get the same bill letter', async () => {
    const owner = await newOwner();
    const admin = createDeviceAdmin(() => Promise.resolve(owner.client));
    const [a, b] = await Promise.all([newPhone(), newPhone()]);
    const [ia, ib] = await Promise.all([a.registration.refresh(), b.registration.refresh()]);
    await Promise.all([admin.approve(ia.id), admin.approve(ib.id)]);
    const [ca, cb] = await Promise.all([a.registration.refresh(), b.registration.refresh()]);
    expect(ca.code).not.toBeNull();
    expect(ca.code).not.toBe(cb.code);
  });

  it('a phone cannot approve or revoke phones, even with the admin code', async () => {
    const approvedPhone = await newDevice();
    const target = await newPhone();
    const info = await target.registration.refresh();
    const phoneAsAdmin = createDeviceAdmin(() => Promise.resolve(approvedPhone.client));

    expect(await phoneAsAdmin.list()).toEqual([expect.objectContaining({ id: approvedPhone.deviceId })]);
    await expect(phoneAsAdmin.approve(info.id)).rejects.toThrow();
    expect((await target.registration.refresh()).status).toBe('pending');
    await expect(phoneAsAdmin.revoke(approvedPhone.deviceId)).rejects.toThrow();
  });

  it('a phone signed in as owner on the same browser keeps its own device login', async () => {
    const phone = await newPhone();
    const info = await phone.registration.refresh();
    const owner = await newOwner();
    expect(must(await owner.client.rpc('is_owner'))).toBe(true);
    // The device client is a separate session, so the phone is still the same device.
    expect((await phone.registration.refresh()).id).toBe(info.id);
  });
});
