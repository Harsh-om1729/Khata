import type { KhataDb } from './schema';
import type { BillLineRow, BillRow, CompanyRow, ItemRow, OutboxEntry, PaymentRow, PictureRow, PriceChangeRow, SettingsChangeRow } from './types';

export type Write =
  | { table: 'companies'; row: CompanyRow }
  | { table: 'items'; row: ItemRow }
  | { table: 'price_changes'; row: PriceChangeRow }
  | { table: 'bills'; row: BillRow }
  | { table: 'bill_lines'; row: BillLineRow }
  | { table: 'payments'; row: PaymentRow }
  | { table: 'settings_changes'; row: SettingsChangeRow }
  | { table: 'pictures'; row: PictureRow };

/** Saves rows and their outbox entries in one transaction, so a row is never saved without being queued for the cloud. */
export async function putWithOutbox(db: KhataDb, writes: Write[], now = new Date()): Promise<void> {
  const queued_at = now.toISOString();
  await db.transaction('rw', db.allTables(), async () => {
    for (const write of writes) {
      // Money records and logs use add, not put: an existing row is never overwritten.
      switch (write.table) {
        case 'companies':
          await db.companies.put(write.row);
          break;
        case 'items':
          await db.items.put(write.row);
          break;
        case 'price_changes':
          await db.price_changes.add(write.row);
          break;
        case 'bills':
          await db.bills.add(write.row);
          break;
        case 'bill_lines':
          await db.bill_lines.add(write.row);
          break;
        case 'payments':
          await db.payments.add(write.row);
          break;
        case 'settings_changes':
          await db.settings_changes.add(write.row);
          break;
        case 'pictures': {
          await db.pictures.put(write.row);
          const entry: OutboxEntry = { table: 'pictures', path: write.row.path, queued_at };
          await db.outbox.add(entry);
          continue;
        }
      }
      await db.outbox.add({ ...write, queued_at });
    }
  });
}
