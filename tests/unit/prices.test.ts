import { afterEach, describe, expect, it } from 'vitest';
import { KhataDb, changePrice, createCompany, createItem, priceHistory, type Author } from '../../src/db';
import type { StaffMember } from '../../src/staff/types';

const staff = (id: string, is_owner = false): StaffMember => ({ id, name: id, photo: null, is_owner, active: true, pin_version: 1, removed_at: null });
const owner: Author = { staff: staff('staff-owner', true), deviceId: 'device-1' };
const ramesh: Author = { staff: staff('staff-ramesh'), deviceId: 'device-2' };

const opened: KhataDb[] = [];
async function withItem(price = 40_000) {
  const db = new KhataDb(`test-${crypto.randomUUID()}`);
  opened.push(db);
  const company = await createCompany(db, owner, { name: 'Ultratech' });
  const item = await createItem(db, owner, { company_id: company.id, name_en: 'Cement', price_paise: price });
  return { db, item };
}

afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

describe('price change with a log (M1-4)', () => {
  it('sets the new default price and logs who, when, old and new', async () => {
    const { db, item } = await withItem(40_000);
    const change = await changePrice(db, ramesh, item.id, 42_000);
    expect(change).toMatchObject({ item_id: item.id, old_paise: 40_000, new_paise: 42_000, staff_id: 'staff-ramesh', device_id: 'device-2', server_at: null });
    expect(change?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(change?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect((await db.items.get(item.id))?.price_paise).toBe(42_000);
  });

  it('queues the log row and the item for the cloud', async () => {
    const { db, item } = await withItem();
    const change = await changePrice(db, ramesh, item.id, 42_000);
    const queued = (await db.outbox.toArray()).slice(-2);
    expect(queued).toMatchObject([
      { table: 'price_changes', row: change },
      { table: 'items', row: { id: item.id, price_paise: 42_000 } },
    ]);
  });

  it('keeps every change, newest first, each with its own old price', async () => {
    const { db, item } = await withItem(40_000);
    await changePrice(db, owner, item.id, 42_000);
    await new Promise((r) => setTimeout(r, 5));
    await changePrice(db, ramesh, item.id, 41_000);
    const history = await priceHistory(db, item.id);
    expect(history.map((c) => [c.old_paise, c.new_paise, c.staff_id])).toEqual([
      [42_000, 41_000, 'staff-ramesh'],
      [40_000, 42_000, 'staff-owner'],
    ]);
  });

  it('does nothing when the price is the same', async () => {
    const { db, item } = await withItem(40_000);
    const before = await db.outbox.count();
    expect(await changePrice(db, ramesh, item.id, 40_000)).toBeNull();
    expect(await db.price_changes.count()).toBe(0);
    expect(await db.outbox.count()).toBe(before);
  });

  it('refuses prices that are not whole paise, and an unknown item', async () => {
    const { db, item } = await withItem();
    await expect(changePrice(db, ramesh, item.id, 420.5)).rejects.toThrow();
    await expect(changePrice(db, ramesh, item.id, -100)).rejects.toThrow();
    await expect(changePrice(db, ramesh, 'no-such-item', 100)).rejects.toThrow();
    await expect(changePrice(db, { staff: null, deviceId: 'device-1' }, item.id, 100)).rejects.toThrow();
    expect(await db.price_changes.count()).toBe(0);
  });

  it('changes neither the price nor the log when the queue write fails', async () => {
    const { db, item } = await withItem(40_000);
    db.outbox.hook('creating', () => {
      throw new Error('disk full');
    });
    await expect(changePrice(db, ramesh, item.id, 42_000)).rejects.toThrow();
    expect((await db.items.get(item.id))?.price_paise).toBe(40_000);
    expect(await db.price_changes.count()).toBe(0);
  });

  it('never overwrites a log row', async () => {
    const { db, item } = await withItem(40_000);
    const change = await changePrice(db, ramesh, item.id, 42_000);
    if (!change) throw new Error('expected a change');
    const { putWithOutbox } = await import('../../src/db/outbox');
    await expect(putWithOutbox(db, [{ table: 'price_changes', row: { ...change, new_paise: 1 } }])).rejects.toThrow();
    expect((await db.price_changes.get(change.id))?.new_paise).toBe(42_000);
  });
});
