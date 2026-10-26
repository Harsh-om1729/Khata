import { describe, expect, it } from 'vitest';
import { createStaffAdmin } from '../../src/auth/staff-admin';
import { createPinLock } from '../../src/staff/pin-lock';
import { createPinVault } from '../../src/staff/pin-vault';
import { createPinVerifier, createStaffDirectory } from '../../src/staff/server';
import { createStaffLogin } from '../../src/staff/staff-login';
import { memoryStore } from '../../src/staff/store';
import { newDevice, newOwner } from './helpers';

describe('M0-7 on real logins: owner adds staff, phone unlocks online then offline', () => {
  it('runs the whole flow with the app code', async () => {
    const [owner, phone] = await Promise.all([newOwner(), newDevice()]);
    const admin = createStaffAdmin(() => Promise.resolve(owner.client));
    const name = `Ramesh ${crypto.randomUUID().slice(0, 6)}`;
    await admin.add({ name, pin: '2468', isOwner: false });

    const store = memoryStore();
    const vault = createPinVault(store);
    const directory = createStaffDirectory({ store, vault, load: () => Promise.resolve(phone.client) });
    const members = await directory.refresh();
    const ramesh = members.find((m) => m.name === name);
    if (!ramesh) throw new Error('new staff member not in the phone list');
    expect(Object.keys(ramesh)).not.toContain('pin_hash');

    let online = true;
    const realVerifier = createPinVerifier(() => Promise.resolve(phone.client));
    const verifier = { verify: (id: string, pin: string) => (online ? realVerifier.verify(id, pin) : Promise.reject(new Error('offline'))) };
    const login = createStaffLogin({ vault, lock: createPinLock(store), verifier });

    expect(await login.login(ramesh, '0000')).toEqual({ kind: 'wrong' });
    expect(await login.login(ramesh, '2468')).toEqual({ kind: 'ok' });

    online = false;
    expect(await login.login(ramesh, '2468')).toEqual({ kind: 'ok' });

    // The owner resets the PIN; once the phone syncs, the old offline PIN stops working.
    await admin.resetPin(ramesh.id, '1357');
    online = true;
    const synced = (await directory.refresh()).find((m) => m.id === ramesh.id);
    if (!synced) throw new Error('staff member vanished');
    expect(synced.pin_version).toBe(2);
    online = false;
    expect(await login.login(synced, '2468')).toEqual({ kind: 'needsInternet' });
    online = true;
    expect(await login.login(synced, '1357')).toEqual({ kind: 'ok' });

    // The owner removes them; after sync they can no longer unlock this phone offline.
    await admin.remove(ramesh.id);
    const afterRemoval = (await directory.refresh()).find((m) => m.id === ramesh.id);
    expect(afterRemoval?.removed_at).not.toBeNull();
    online = false;
    if (!afterRemoval) throw new Error('removed staff should stay in the list for history');
    expect(await login.login(afterRemoval, '1357')).toEqual({ kind: 'needsInternet' });
  });

  it('a phone cannot use the owner staff functions', async () => {
    const phone = await newDevice();
    const asPhone = createStaffAdmin(() => Promise.resolve(phone.client));
    await expect(asPhone.add({ name: 'Sneaky', pin: '1111', isOwner: true })).rejects.toMatchObject({ code: '42501' });
  });
});
