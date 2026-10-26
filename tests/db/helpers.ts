import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; run the db tests with npm run test:db`);
  return value;
}

const url = env('SUPABASE_URL');
const anonKey = env('SUPABASE_ANON_KEY');
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), noSession);
export const signedOut = (): SupabaseClient => createClient(url, anonKey, noSession);

export const id = (): string => randomUUID();
export const now = (): string => new Date().toISOString();

export function must<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error('no data returned');
  return result.data;
}

export function mustOk(result: { error: unknown }): void {
  if (result.error) throw result.error;
}

export interface Device {
  client: SupabaseClient;
  deviceId: string;
}

function randomCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const chars = letters + '0123456789';
  const pick = (set: string) => set.charAt(Math.floor(Math.random() * set.length));
  return pick(letters) + pick(chars) + pick(chars);
}

async function register(client: SupabaseClient, authUserId: string): Promise<string> {
  const deviceId = id();
  mustOk(await client.from('devices').insert({ id: deviceId, auth_user_id: authUserId, name: 'test phone', created_at: now() }));
  return deviceId;
}

export async function setDeviceStatus(deviceId: string, status: 'approved' | 'revoked'): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await admin.from('devices').update({ status, code: randomCode() }).eq('id', deviceId);
    if (!error) return;
    if (error.code !== '23505') throw error;
  }
  throw new Error('could not find a free device code');
}

export async function newDevice(status: 'pending' | 'approved' | 'revoked' = 'approved'): Promise<Device> {
  const client = signedOut();
  const user = must(await client.auth.signInAnonymously()).user;
  if (!user) throw new Error('anonymous sign-in returned no user');
  const deviceId = await register(client, user.id);
  if (status !== 'pending') await setDeviceStatus(deviceId, status);
  return { client, deviceId };
}

export async function newOwner(): Promise<Device> {
  const email = `owner-${id()}@test.local`;
  const password = `pw-${id()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const { user } = data;
  mustOk(await admin.from('owners').insert({ user_id: user.id }));
  const client = signedOut();
  mustOk(await client.auth.signInWithPassword({ email, password }));
  const deviceId = await register(client, user.id);
  await setDeviceStatus(deviceId, 'approved');
  return { client, deviceId };
}

export interface Shop {
  staffId: string;
  ownerStaffId: string;
  itemId: string;
  customerId: string;
}

export async function seedShop(): Promise<Shop> {
  const shop: Shop = { staffId: id(), ownerStaffId: id(), itemId: id(), customerId: id() };
  const companyId = id();
  mustOk(await admin.from('staff').insert([
    { id: shop.staffId, name: 'Ramesh', pin_hash: 'x', is_owner: false, created_at: now() },
    { id: shop.ownerStaffId, name: 'Owner', pin_hash: 'x', is_owner: true, created_at: now() },
  ]));
  mustOk(await admin.from('companies').insert({ id: companyId, name: `Ultratech ${companyId}`, created_at: now() }));
  mustOk(await admin.from('items').insert({
    id: shop.itemId, company_id: companyId, name_en: 'Cement', size: '50kg', unit: 'bag',
    price_paise: 42_000, created_at: now(),
  }));
  mustOk(await admin.from('customers').insert({ id: shop.customerId, name: 'Suresh', phone: '9876543210', created_at: now() }));
  return shop;
}

export function billRow(device: Device, shop: Shop, totalPaise: number, extra: Record<string, unknown> = {}) {
  return {
    id: id(), device_id: device.deviceId, bill_no: `T-${id().slice(0, 8)}`, staff_id: shop.staffId,
    total_paise: totalPaise, created_at: now(), ...extra,
  };
}

export async function insertBill(device: Device, shop: Shop, totalPaise: number, extra: Record<string, unknown> = {}) {
  const bill = billRow(device, shop, totalPaise, extra);
  mustOk(await device.client.from('bills').insert(bill));
  return bill;
}

export function paymentRow(device: Device, shop: Shop, fields: Record<string, unknown>) {
  return { id: id(), device_id: device.deviceId, staff_id: shop.staffId, created_at: now(), ...fields };
}
