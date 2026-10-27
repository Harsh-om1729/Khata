import type { KhataDb } from './schema';
import type { CompanyRow, ItemRow } from './types';

type Write = { table: 'companies'; row: CompanyRow } | { table: 'items'; row: ItemRow };

/** Saves rows and their outbox entries in one transaction, so a row is never saved without being queued for the cloud. */
export async function putWithOutbox(db: KhataDb, writes: Write[], now = new Date()): Promise<void> {
  const queued_at = now.toISOString();
  await db.transaction('rw', db.companies, db.items, db.outbox, async () => {
    for (const write of writes) {
      if (write.table === 'companies') await db.companies.put(write.row);
      else await db.items.put(write.row);
      await db.outbox.add({ ...write, queued_at });
    }
  });
}
