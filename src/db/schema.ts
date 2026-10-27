import Dexie, { type EntityTable } from 'dexie';
import type { CompanyRow, ItemRow, OutboxEntry, PictureRow } from './types';

export class KhataDb extends Dexie {
  declare companies: EntityTable<CompanyRow, 'id'>;
  declare items: EntityTable<ItemRow, 'id'>;
  declare pictures: EntityTable<PictureRow, 'path'>;
  declare outbox: EntityTable<OutboxEntry, 'seq'>;

  constructor(name = 'khata') {
    super(name);
    this.version(1).stores({
      companies: 'id, name',
      items: 'id, company_id',
      outbox: '++seq, table',
    });
    this.version(2).stores({ pictures: 'path' });
  }

  /** Every table a catalog write touches, so nested writes share one transaction. */
  catalogTables() {
    return [this.companies, this.items, this.pictures, this.outbox];
  }
}
