import type { KhataDb } from './schema';
import type { CompanyRow, ItemRow, OutboxEntry, PictureRow, PriceChangeRow } from './types';

export type Write =
  | { table: 'companies'; row: CompanyRow }
  | { table: 'items'; row: ItemRow }
  | { table: 'price_changes'; row: PriceChangeRow }
  | { table: 'pictures'; row: PictureRow };

/** Saves rows and their outbox entries in one transaction, so a row is never saved without being queued for the cloud. */
export async function putWithOutbox(db: KhataDb, writes: Write[], now = new Date()): Promise<void> {
  const queued_at = now.toISOString();
  await db.transaction('rw', db.catalogTables(), async () => {
    for (const write of writes) {
      if (write.table === 'companies') {
        await db.companies.put(write.row);
        await db.outbox.add({ ...write, queued_at });
      } else if (write.table === 'items') {
        await db.items.put(write.row);
        await db.outbox.add({ ...write, queued_at });
      } else if (write.table === 'price_changes') {
        // add, not put: an existing log row is never overwritten.
        await db.price_changes.add(write.row);
        await db.outbox.add({ ...write, queued_at });
      } else {
        await db.pictures.put(write.row);
        const entry: OutboxEntry = { table: 'pictures', path: write.row.path, queued_at };
        await db.outbox.add(entry);
      }
    }
  });
}
