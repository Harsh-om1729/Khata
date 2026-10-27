import type { StaffMember } from '../staff/types';
import { stampRecord } from '../staff/stamp';
import type { KhataDb } from './schema';
import { putWithOutbox, type Write } from './outbox';
import type { CompanyRow, ItemRow, PictureRow, Unit } from './types';

export interface Author {
  staff: StaffMember | null;
  deviceId: string | null;
}

export class DuplicateError extends Error {
  constructor(what: string) {
    super(`${what} already exists`);
    this.name = 'DuplicateError';
  }
}

export interface NewCompany {
  name: string;
  picture?: string | null;
}

export interface NewItem {
  company_id: string;
  name_hi?: string;
  name_en?: string;
  size?: string;
  unit?: Unit;
  price_paise: number;
  category?: string;
}

/** Same rule as the server's unique index: Company + Item name (English, else Hindi) + Size, ignoring case. */
export function itemKey(item: Pick<ItemRow, 'company_id' | 'name_en' | 'name_hi' | 'size'>): string {
  const name = item.name_en !== '' ? item.name_en : item.name_hi;
  return [item.company_id, name.toLowerCase(), item.size.toLowerCase()].join('\u0000');
}

function isValidPaise(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export async function createCompany(db: KhataDb, author: Author, input: NewCompany): Promise<CompanyRow> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80) throw new Error('company name must be 1 to 80 characters');
  const stamp = stampRecord(author.staff, author.deviceId);
  const row: CompanyRow = { ...stamp, server_at: null, name, picture: input.picture ?? null, archived: false };
  await db.transaction('rw', db.catalogTables(), async () => {
    const lower = name.toLowerCase();
    if (await db.companies.filter((c) => c.name.toLowerCase() === lower).count()) throw new DuplicateError('company');
    await putWithOutbox(db, [{ table: 'companies', row }]);
  });
  return row;
}

export async function createItem(db: KhataDb, author: Author, input: NewItem, photo?: Blob): Promise<ItemRow> {
  const name_hi = (input.name_hi ?? '').trim();
  const name_en = (input.name_en ?? '').trim();
  if (name_hi === '' && name_en === '') throw new Error('item needs a Hindi or English name');
  if (!isValidPaise(input.price_paise)) throw new Error('price must be whole paise, 0 or more');
  const stamp = stampRecord(author.staff, author.deviceId);
  // Read the photo before the transaction: waiting on anything else inside one makes it commit early.
  const picture = photo ? await pictureRow(photo, stamp.created_at) : null;
  const row: ItemRow = {
    ...stamp,
    server_at: null,
    company_id: input.company_id,
    name_hi,
    name_en,
    size: (input.size ?? '').trim(),
    unit: input.unit ?? 'piece',
    price_paise: input.price_paise,
    category: (input.category ?? '').trim(),
    picture: null,
    // SPEC §3.1A.5: items added by staff wait for the owner's check.
    needs_review: !author.staff?.is_owner,
    archived: false,
  };
  await db.transaction('rw', db.catalogTables(), async () => {
    if (!(await db.companies.get(row.company_id))) throw new Error('company not found');
    const key = itemKey(row);
    const siblings = await db.items.where('company_id').equals(row.company_id).toArray();
    if (siblings.some((s) => itemKey(s) === key)) throw new DuplicateError('item');
    const writes: Write[] = [];
    if (picture) {
      row.picture = picture.path;
      writes.push({ table: 'pictures', row: picture });
    }
    writes.push({ table: 'items', row });
    await putWithOutbox(db, writes);
  });
  return row;
}

async function pictureRow(blob: Blob, created_at: string): Promise<PictureRow> {
  const type = blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const ext = type === 'image/webp' ? 'webp' : 'jpg';
  return { path: `items/${crypto.randomUUID()}.${ext}`, bytes: await blob.arrayBuffer(), type, created_at };
}

/** Gives an item a new photo. Photos are not money records, so the old one is dropped to save phone space. */
export async function setItemPicture(db: KhataDb, itemId: string, photo: Blob, now = new Date()): Promise<ItemRow> {
  const picture = await pictureRow(photo, now.toISOString());
  return db.transaction('rw', db.catalogTables(), async () => {
    const item = await db.items.get(itemId);
    if (!item) throw new Error('item not found');
    const row: ItemRow = { ...item, picture: picture.path, server_at: null };
    await putWithOutbox(db, [{ table: 'pictures', row: picture }, { table: 'items', row }], now);
    if (item.picture) await db.pictures.delete(item.picture);
    return row;
  });
}

/** Archive hides a company or item from billing; it is never deleted (SPEC §3.1A.6). */
export async function setArchived(db: KhataDb, table: 'companies' | 'items', id: string, archived: boolean): Promise<void> {
  await db.transaction('rw', db.catalogTables(), async () => {
    if (table === 'companies') {
      const row = await db.companies.get(id);
      if (!row) throw new Error('company not found');
      await putWithOutbox(db, [{ table, row: { ...row, archived, server_at: null } }]);
    } else {
      const row = await db.items.get(id);
      if (!row) throw new Error('item not found');
      await putWithOutbox(db, [{ table, row: { ...row, archived, server_at: null } }]);
    }
  });
}

export async function activeCompanies(db: KhataDb): Promise<CompanyRow[]> {
  const rows = await db.companies.orderBy('name').toArray();
  return rows.filter((c) => !c.archived);
}

export async function activeItems(db: KhataDb, companyId: string): Promise<ItemRow[]> {
  const rows = await db.items.where('company_id').equals(companyId).toArray();
  return rows.filter((i) => !i.archived);
}
