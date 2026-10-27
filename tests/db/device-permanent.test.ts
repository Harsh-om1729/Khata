import { describe, expect, it } from 'vitest';
import { createDeviceAdmin } from '../../src/auth/device-admin';
import { createDeviceRegistration } from '../../src/sync/device-registration';
import { memoryStore } from '../../src/staff/store';
import { admin, must, newDevice, newOwner, signedOut } from './helpers';

async function registerPhone() {
  const client = signedOut();
  const registration = createDeviceRegistration(() => Promise.resolve(client), memoryStore());
  return { client, registration, info: await registration.refresh() };
}

async function codeOf(deviceId: string) {
  return must(await admin.from('devices').select('code').eq('id', deviceId).single()).code as string | null;
}

describe('M0-6c: phones are permanent and bill letters are never reused', () => {
  it('a turned-off phone keeps its letter, and no other phone ever gets it', async () => {
    const owner = await newOwner();
    const devices = createDeviceAdmin(() => Promise.resolve(owner.client));

    const first = await registerPhone();
    await devices.approve(first.info.id);
    const firstLetter = await codeOf(first.info.id);
    await devices.revoke(first.info.id);
    expect(await codeOf(first.info.id)).toBe(firstLetter);

    const others = await Promise.all([registerPhone(), registerPhone(), registerPhone()]);
    for (const other of others) await devices.approve(other.info.id);
    const letters = await Promise.all(others.map((o) => codeOf(o.info.id)));
    expect(letters).not.toContain(firstLetter);
    expect(new Set(letters).size).toBe(letters.length);

    await devices.approve(first.info.id);
    expect(await codeOf(first.info.id)).toBe(firstLetter);
  });

  it('nobody can change or clear a letter once given, not even with the service key', async () => {
    const owner = await newOwner();
    const phone = await newDevice();
    const letter = await codeOf(phone.deviceId);

    expect((await owner.client.from('devices').update({ code: null }).eq('id', phone.deviceId)).error?.message)
      .toContain('never changes');
    expect((await admin.from('devices').update({ code: 'ZZ9' }).eq('id', phone.deviceId)).error?.message)
      .toContain('never changes');
    expect(await codeOf(phone.deviceId)).toBe(letter);
  });

  it('nobody can delete a phone, not even the owner or the service key', async () => {
    const owner = await newOwner();
    const phone = await newDevice('revoked');
    for (const client of [owner.client, phone.client]) {
      expect((await client.from('devices').delete().eq('id', phone.deviceId)).error).not.toBeNull();
    }
    expect((await admin.from('devices').delete().eq('id', phone.deviceId)).error?.message).toContain('never deleted');
    expect(must(await admin.from('devices').select('id').eq('id', phone.deviceId))).toHaveLength(1);
  });

  it('only the owner can rename a phone', async () => {
    const owner = await newOwner();
    const phone = await registerPhone();
    await createDeviceAdmin(() => Promise.resolve(owner.client)).rename(phone.info.id, 'Ramesh counter');
    expect(must(await admin.from('devices').select('name').eq('id', phone.info.id).single()).name).toBe('Ramesh counter');

    const asPhone = createDeviceAdmin(() => Promise.resolve(phone.client));
    await expect(asPhone.rename(phone.info.id, 'Mine now')).rejects.toThrow();
  });

  it('opening the app records "last seen", even for a pending phone', async () => {
    const phone = await registerPhone();
    const seen = must(await admin.from('devices').select('last_seen').eq('id', phone.info.id).single()).last_seen as string | null;
    expect(seen).not.toBeNull();
    expect(Math.abs(Date.now() - new Date(seen ?? 0).getTime())).toBeLessThan(60_000);
  });
});
