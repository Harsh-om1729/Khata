import Dexie, { type EntityTable } from 'dexie';
import type { BillCounterRow, CompanyRow, ItemRow, OutboxEntry, PictureRow, PriceChangeRow } from './types';

export class KhataDb extends Dexie {
  declare companies: EntityTable<CompanyRow, 'id'>;
  declare items: EntityTable<ItemRow, 'id'>;
  declare pictures: EntityTable<PictureRow, 'path'>;
  declare price_changes: EntityTable<PriceChangeRow, 'id'>;
  declare bill_counters: EntityTable<BillCounterRow, 'day'>;
  declare outbox: EntityTable<OutboxEntry, 'seq'>;

  constructor(name = 'khata') {
    super(name);
    this.version(1).stores({
      companies: 'id, name',
      items: 'id, company_id',
      outbox: '++seq, table',
    });
    this.version(2).stores({ pictures: 'path' });
    this.version(3).stores({ price_changes: 'id, item_id' });
    this.version(4).stores({ bill_counters: 'day' });
  }

  /** Every table a catalog write touches, so nested writes share one transaction. */
  catalogTables() {
    return [this.companies, this.items, this.pictures, this.price_changes, this.outbox];
  }
}
