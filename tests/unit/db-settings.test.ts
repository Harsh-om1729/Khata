import { afterEach, describe, expect, it } from 'vitest';
import { KhataDb, ProfileInvalidError, saveShopProfile, shopProfile, type Author } from '../../src/db';
import { emptyProfile } from '../../src/profile';
import type { StaffMember } from '../../src/staff/types';

const staff = (id: string): StaffMember => ({ id, name: id, photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null });
const ramesh: Author = { staff: staff('staff-ramesh'), deviceId: 'device-1' };
const sita: Author = { staff: staff('staff-sita'), deviceId: 'device-2' };

const opened: KhataDb[] = [];
function freshDb() {
  const db = new KhataDb(`test-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

const tick = () => new Promise((r) => setTimeout(r, 5));

describe('shop profile on the phone (U-1)', () => {
  it('is empty before anything is saved', async () => {
    expect(await shopProfile(freshDb())).toEqual(emptyProfile());
  });

  it('saves one append-only change per filled field, queued for the cloud', async () => {
    const db = freshDb();
    await saveShopProfile(db, ramesh, { ...emptyProfile(), shop_name: 'Anand Hardware', phone1: '+91 98765 43210', state: '10' });

    const changes = await db.settings_changes.toArray();
    expect(changes.map((c) => [c.field, c.new_value]).sort()).toEqual([
      ['phone1', '9876543210'], ['shop_name', 'Anand Hardware'], ['state', '10'],
    ]);
    expect(changes.every((c) => c.staff_id === 'staff-ramesh' && c.device_id === 'device-1' && c.server_at === null)).toBe(true);
    expect(new Set(changes.map((c) => c.id)).size).toBe(3);
    const queued = await db.outbox.toArray();
    expect(queued.map((q) => q.table)).toEqual(['settings_changes', 'settings_changes', 'settings_changes']);
  });

  it('reads back the newest value of each field', async () => {
    const db = freshDb();
    await saveShopProfile(db, ramesh, { ...emptyProfile(), shop_name: 'Anand Hardware', pincode: '800001' });
    await tick();
    await saveShopProfile(db, sita, { ...emptyProfile(), shop_name: 'Anand Hardware Store', pincode: '800001' });
    expect(await shopProfile(db)).toMatchObject({ shop_name: 'Anand Hardware Store', pincode: '800001' });
  });

  it('writes only the fields that changed, and nothing when nothing changed', async () => {
    const db = freshDb();
    const first = { ...emptyProfile(), shop_name: 'Anand Hardware', address: 'Main Road' };
    await saveShopProfile(db, ramesh, first);
    await tick();
    await saveShopProfile(db, ramesh, { ...first, address: 'Station Road' });
    await saveShopProfile(db, ramesh, { ...first, address: 'Station Road' });
    expect((await db.settings_changes.toArray()).map((c) => c.field).sort()).toEqual(['address', 'address', 'shop_name']);
  });

  it('records clearing a field as an empty value', async () => {
    const db = freshDb();
    await saveShopProfile(db, ramesh, { ...emptyProfile(), shop_name: 'Anand Hardware', phone2: '9876543211' });
    await tick();
    await saveShopProfile(db, ramesh, { ...emptyProfile(), shop_name: 'Anand Hardware' });
    expect((await db.settings_changes.where('field').equals('phone2').sortBy('created_at')).map((c) => c.new_value))
      .toEqual(['9876543211', null]);
    expect((await shopProfile(db)).phone2).toBe('');
  });

  it('saves nothing when any field is wrong, and says which', async () => {
    const db = freshDb();
    const saving = saveShopProfile(db, ramesh, { ...emptyProfile(), shop_name: 'Anand Hardware', gstin: 'NOT-A-GSTIN' });
    await expect(saving).rejects.toBeInstanceOf(ProfileInvalidError);
    await expect(saving).rejects.toMatchObject({ problems: { gstin: 'gstin' } });
    expect(await db.settings_changes.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('needs an unlocked staff member', async () => {
    const db = freshDb();
    await expect(saveShopProfile(db, { staff: null, deviceId: 'device-1' }, { ...emptyProfile(), shop_name: 'x' })).rejects.toThrow();
    expect(await db.settings_changes.count()).toBe(0);
  });
});
