import { afterEach, describe, expect, it } from 'vitest';
import { KhataDb, createCompany, createItem, setItemPicture, type Author } from '../../src/db';
import { MAX_SIDE, fitWithin } from '../../src/pictures/compress';
import type { StaffMember } from '../../src/staff/types';

const owner: StaffMember = { id: 'staff-owner', name: 'Harsh', photo: null, is_owner: true, active: true, pin_version: 1, removed_at: null };
const author: Author = { staff: owner, deviceId: 'device-1' };
const photo = (content: string) => new Blob([content], { type: 'image/webp' });
const text = (bytes: ArrayBuffer) => new TextDecoder().decode(bytes);

const opened: KhataDb[] = [];
async function withItem(withPhoto?: Blob) {
  const db = new KhataDb(`test-${crypto.randomUUID()}`);
  opened.push(db);
  const company = await createCompany(db, author, { name: 'Ultratech' });
  const item = await createItem(db, author, { company_id: company.id, name_en: 'Cement', price_paise: 100 }, withPhoto);
  return { db, item };
}

afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

describe('photo size (M1-3)', () => {
  it('shrinks the longest side to the limit and keeps the shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_SIDE, height: 360 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 360, height: MAX_SIDE });
  });

  it('never enlarges a small photo', () => {
    expect(fitWithin(200, 100)).toEqual({ width: 200, height: 100 });
  });
});

describe('item pictures on the phone (M1-3)', () => {
  it('an item without a photo has no picture', async () => {
    const { db, item } = await withItem();
    expect(item.picture).toBeNull();
    expect(await db.pictures.count()).toBe(0);
  });

  it('saves the photo with the item and queues both for the cloud', async () => {
    const { db, item } = await withItem(photo('first'));
    expect(item.picture).toMatch(/^items\/[0-9a-f-]{36}\.webp$/);
    const saved = await db.pictures.get(item.picture ?? '');
    expect(saved && text(saved.bytes)).toBe('first');
    expect(saved?.type).toBe('image/webp');
    const queued = await db.outbox.toArray();
    expect(queued.map((e) => e.table)).toEqual(['companies', 'pictures', 'items']);
    expect(queued[1]).toMatchObject({ path: item.picture });
  });

  it('a new photo replaces the old one and is queued', async () => {
    const { db, item } = await withItem(photo('first'));
    const updated = await setItemPicture(db, item.id, new Blob(['second'], { type: 'image/jpeg' }));
    expect(updated.picture).toMatch(/\.jpg$/);
    expect(updated.picture).not.toBe(item.picture);
    expect((await db.items.get(item.id))?.picture).toBe(updated.picture);
    expect(await db.pictures.get(item.picture ?? '')).toBeUndefined();
    const saved = await db.pictures.get(updated.picture ?? '');
    expect(saved && text(saved.bytes)).toBe('second');
    expect(await db.outbox.where('table').equals('pictures').count()).toBe(2);
  });

  it('saves neither the photo nor the item change when the queue write fails', async () => {
    const { db, item } = await withItem();
    db.outbox.hook('creating', () => {
      throw new Error('disk full');
    });
    await expect(setItemPicture(db, item.id, photo('x'))).rejects.toThrow();
    expect(await db.pictures.count()).toBe(0);
    expect((await db.items.get(item.id))?.picture).toBeNull();
  });
});
