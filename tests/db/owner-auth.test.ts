import { describe, expect, it } from 'vitest';
import { admin, id, must, newDevice, newOwner, seedShop, signedOut } from './helpers';

describe('owner sign-in on the database', () => {
  it('the owner account is recognised as owner and can manage staff', async () => {
    const owner = await newOwner();
    expect(must(await owner.client.rpc('is_owner'))).toBe(true);
    await seedShop();
    expect(must(await owner.client.from('staff').select('id')).length).toBeGreaterThan(0);
  });

  it('another email account is not the owner and sees nothing', async () => {
    await seedShop();
    const email = `stranger-${id()}@test.local`;
    const password = `pw-${id()}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    const client = signedOut();
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;

    expect(must(await client.rpc('is_owner'))).toBe(false);
    expect(must(await client.from('staff').select('id'))).toEqual([]);
    expect(must(await client.from('devices').select('id'))).toEqual([]);
  });

  it('an anonymous staff phone is never the owner', async () => {
    const phone = await newDevice();
    expect(must(await phone.client.rpc('is_owner'))).toBe(false);
  });

  it('after sign-out the owner has no access', async () => {
    const owner = await newOwner();
    const signOut = await owner.client.auth.signOut();
    if (signOut.error) throw signOut.error;
    const { data, error } = await owner.client.rpc('is_owner');
    expect(error !== null || data === false).toBe(true);
    const staff = await owner.client.from('staff').select('id');
    expect(staff.error !== null || (staff.data ?? []).length === 0).toBe(true);
  });
});
