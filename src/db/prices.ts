import { stampRecord } from '../staff/stamp';
import type { Author } from './catalog';
import { putWithOutbox } from './outbox';
import type { KhataDb } from './schema';
import type { PriceChangeRow } from './types';

/** Sets an item's default price and logs who changed it, when, old and new. Returns null when the price is unchanged. */
export async function changePrice(db: KhataDb, author: Author, itemId: string, newPaise: number): Promise<PriceChangeRow | null> {
  if (!Number.isSafeInteger(newPaise) || newPaise < 0) throw new Error('price must be whole paise, 0 or more');
  const stamp = stampRecord(author.staff, author.deviceId);
  return db.transaction('rw', db.allTables(), async () => {
    const item = await db.items.get(itemId);
    if (!item) throw new Error('item not found');
    if (item.price_paise === newPaise) return null;
    const change: PriceChangeRow = { ...stamp, server_at: null, item_id: itemId, old_paise: item.price_paise, new_paise: newPaise };
    await putWithOutbox(db, [
      { table: 'price_changes', row: change },
      { table: 'items', row: { ...item, price_paise: newPaise, server_at: null } },
    ]);
    return change;
  });
}

/** Newest first. */
export async function priceHistory(db: KhataDb, itemId: string): Promise<PriceChangeRow[]> {
  const rows = await db.price_changes.where('item_id').equals(itemId).toArray();
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
