import { afterEach, describe, expect, it } from 'vitest';
import {
  DuplicateError,
  KhataDb,
  activeCompanies,
  activeItems,
  createCompany,
  createItem,
  setArchived,
  type Author,
} from '../../src/db';
import type { StaffMember } from '../../src/staff/types';

const ramesh: StaffMember = { id: 'staff-ramesh', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };
const owner: StaffMember = { ...ramesh, id: 'staff-owner', name: 'Malik', is_owner: true };
const staffAuthor: Author = { staff: ramesh, deviceId: 'device-1' };
const ownerAuthor: Author = { staff: owner, deviceId: 'device-1' };

const opened: KhataDb[] = [];
function freshDb(name = `test-${crypto.randomUUID()}`): KhataDb {
  const db = new KhataDb(name);
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

describe('local catalog (M1-1)', () => {
  it('saves a company with a phone-made UUID, phone, person and time, and queues it for the cloud', async () => {
    const db = freshDb();
    const company = await createCompany(db, staffAuthor, { name: '  Ultratech ' });
    expect(company).toMatchObject({ name: 'Ultratech', device_id: 'device-1', staff_id: 'staff-ramesh', server_at: null, archived: false });
    expect(company.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await db.companies.get(company.id)).toEqual(company);
    const queued = await db.outbox.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ table: 'companies', row: company });
  });

  it('saves an item with integer paise and fills defaults for everything not asked', async () => {
    const db = freshDb();
    const company = await createCompany(db, ownerAuthor, { name: 'Ultratech' });
    const item = await createItem(db, ownerAuthor, { company_id: company.id, name_hi: 'सीमेंट', size: '50kg', price_paise: 42_000 });
    expect(item).toMatchObject({ name_en: '', unit: 'piece', category: '', picture: null, price_paise: 42_000, needs_review: false });
    expect(await db.items.get(item.id)).toEqual(item);
    expect(await db.outbox.where('table').equals('items').count()).toBe(1);
  });

  it('marks items added by staff as "new, check" for the owner', async () => {
    const db = freshDb();
    const company = await createCompany(db, staffAuthor, { name: 'Ultratech' });
    const item = await createItem(db, staffAuthor, { company_id: company.id, name_en: 'Cement', price_paise: 100 });
    expect(item.needs_review).toBe(true);
  });

  it('refuses prices that are not whole paise, and items without a name', async () => {
    const db = freshDb();
    const { id } = await createCompany(db, ownerAuthor, { name: 'Ultratech' });
    await expect(createItem(db, ownerAuthor, { company_id: id, name_en: 'Cement', price_paise: 420.5 })).rejects.toThrow();
    await expect(createItem(db, ownerAuthor, { company_id: id, name_en: 'Cement', price_paise: -1 })).rejects.toThrow();
    await expect(createItem(db, ownerAuthor, { company_id: id, name_en: ' ', price_paise: 100 })).rejects.toThrow();
    await expect(createItem(db, ownerAuthor, { company_id: 'no-such-company', name_en: 'Cement', price_paise: 100 })).rejects.toThrow();
    expect(await db.items.count()).toBe(0);
    expect(await db.outbox.where('table').equals('items').count()).toBe(0);
  });

  it('refuses a record when no staff member is unlocked or the phone is not registered', async () => {
    const db = freshDb();
    await expect(createCompany(db, { staff: null, deviceId: 'device-1' }, { name: 'Ultratech' })).rejects.toThrow();
    await expect(createCompany(db, { staff: ramesh, deviceId: null }, { name: 'Ultratech' })).rejects.toThrow();
    expect(await db.companies.count()).toBe(0);
  });

  it('refuses a duplicate company or item (Company + name + size, ignoring case), like the server does', async () => {
    const db = freshDb();
    const { id } = await createCompany(db, ownerAuthor, { name: 'Ultratech' });
    await expect(createCompany(db, ownerAuthor, { name: 'ULTRATECH' })).rejects.toBeInstanceOf(DuplicateError);
    await createItem(db, ownerAuthor, { company_id: id, name_en: 'Cement', size: '50kg', price_paise: 100 });
    await expect(createItem(db, ownerAuthor, { company_id: id, name_en: 'cement', size: '50KG', price_paise: 200 })).rejects.toBeInstanceOf(DuplicateError);
    await createItem(db, ownerAuthor, { company_id: id, name_en: 'Cement', size: '25kg', price_paise: 60 });
    expect(await db.items.count()).toBe(2);
  });

  it('saves nothing when the outbox write fails, so a row is never left unqueued', async () => {
    const db = freshDb();
    db.outbox.hook('creating', () => {
      throw new Error('disk full');
    });
    await expect(createCompany(db, ownerAuthor, { name: 'Ultratech' })).rejects.toThrow();
    expect(await db.companies.count()).toBe(0);
  });

  it('archives and restores without deleting, and queues each change', async () => {
    const db = freshDb();
    const company = await createCompany(db, ownerAuthor, { name: 'Ultratech' });
    const item = await createItem(db, ownerAuthor, { company_id: company.id, name_en: 'Cement', price_paise: 100 });

    await setArchived(db, 'items', item.id, true);
    expect(await activeItems(db, company.id)).toEqual([]);
    expect((await db.items.get(item.id))?.archived).toBe(true);

    await setArchived(db, 'companies', company.id, true);
    expect(await activeCompanies(db)).toEqual([]);

    await setArchived(db, 'items', item.id, false);
    await setArchived(db, 'companies', company.id, false);
    expect((await activeItems(db, company.id)).map((i) => i.id)).toEqual([item.id]);
    expect((await activeCompanies(db)).map((c) => c.id)).toEqual([company.id]);
    expect(await db.outbox.count()).toBe(6);
  });

  it('keeps everything after the app is closed and opened again', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const first = freshDb(name);
    const company = await createCompany(first, ownerAuthor, { name: 'Ultratech' });
    first.close();
    const second = freshDb(name);
    expect(await second.companies.get(company.id)).toEqual(company);
    expect(await second.outbox.count()).toBe(1);
  });
});
