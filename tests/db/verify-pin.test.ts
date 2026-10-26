import { beforeAll, describe, expect, it } from 'vitest';
import { id, mustOk, newDevice, newOwner, type Device } from './helpers';

let phone: Device;
let owner: Device;
let staffId: string;

beforeAll(async () => {
  [phone, owner] = await Promise.all([newDevice(), newOwner()]);
  staffId = id();
  mustOk(await owner.client.rpc('add_staff', { p_id: staffId, p_name: 'Ramesh', p_pin: '2468' }));
});

describe('verify_staff_pin (first login on a phone)', () => {
  it('returns the pin_version for the right PIN, never the hash', async () => {
    const { data, error } = await phone.client.rpc('verify_staff_pin', { p_id: staffId, p_pin: '2468' });
    expect(error).toBeNull();
    expect(data).toBe(1);
  });

  it('rejects a wrong PIN', async () => {
    const { error } = await phone.client.rpc('verify_staff_pin', { p_id: staffId, p_pin: '0000' });
    expect(error?.code).toBe('28P01');
  });

  it('reports the new pin_version after the owner resets the PIN', async () => {
    const member = id();
    mustOk(await owner.client.rpc('add_staff', { p_id: member, p_name: 'Sita', p_pin: '1111' }));
    mustOk(await owner.client.rpc('reset_staff_pin', { p_id: member, p_new_pin: '2222' }));
    expect((await phone.client.rpc('verify_staff_pin', { p_id: member, p_pin: '1111' })).error?.code).toBe('28P01');
    expect((await phone.client.rpc('verify_staff_pin', { p_id: member, p_pin: '2222' })).data).toBe(2);
  });

  it('refuses a removed staff member', async () => {
    const member = id();
    mustOk(await owner.client.rpc('add_staff', { p_id: member, p_name: 'Mohan', p_pin: '3333' }));
    mustOk(await owner.client.rpc('remove_staff', { p_id: member }));
    expect((await phone.client.rpc('verify_staff_pin', { p_id: member, p_pin: '3333' })).error?.code).toBe('28P01');
  });

  it('refuses a phone that is not approved', async () => {
    const pending = await newDevice('pending');
    const { error } = await pending.client.rpc('verify_staff_pin', { p_id: staffId, p_pin: '2468' });
    expect(error?.code).toBe('42501');
  });
});
