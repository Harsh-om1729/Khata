import Dexie, { type EntityTable } from 'dexie';
import type { CompanyRow, ItemRow, OutboxEntry } from './types';

export class KhataDb extends Dexie {
  declare companies: EntityTable<CompanyRow, 'id'>;
  declare items: EntityTable<ItemRow, 'id'>;
  declare outbox: EntityTable<OutboxEntry, 'seq'>;

  constructor(name = 'khata') {
    super(name);
    this.version(1).stores({
      companies: 'id, name',
      items: 'id, company_id',
      outbox: '++seq, table',
    });
  }
}
