import Dexie, { type EntityTable } from 'dexie';
import type {
  BillCounterRow,
  BillLineRow,
  BillRow,
  CompanyRow,
  ItemRow,
  OutboxEntry,
  PaymentRow,
  PictureRow,
  PriceChangeRow,
} from './types';

export class KhataDb extends Dexie {
  declare companies: EntityTable<CompanyRow, 'id'>;
  declare items: EntityTable<ItemRow, 'id'>;
  declare pictures: EntityTable<PictureRow, 'path'>;
  declare price_changes: EntityTable<PriceChangeRow, 'id'>;
  declare bill_counters: EntityTable<BillCounterRow, 'day'>;
  declare bills: EntityTable<BillRow, 'id'>;
  declare bill_lines: EntityTable<BillLineRow, 'id'>;
  declare payments: EntityTable<PaymentRow, 'id'>;
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
    this.version(5).stores({ bills: 'id, &bill_no, created_at', bill_lines: 'id, bill_id', payments: 'id, bill_id, customer_id' });
  }

  /** Every table a write can touch. Nested transactions must stay inside their parent's tables, so writes always open all of them. */
  allTables() {
    return [
      this.companies, this.items, this.pictures, this.price_changes,
      this.bill_counters, this.bills, this.bill_lines, this.payments, this.outbox,
    ];
  }
}
