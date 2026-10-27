export type Unit = 'piece' | 'kg' | 'metre' | 'bag';

/** Fields every synced record has. `server_at` stays null until the server confirms it. */
interface Synced {
  id: string;
  device_id: string;
  staff_id: string;
  created_at: string;
  server_at: string | null;
}

export interface CompanyRow extends Synced {
  name: string;
  picture: string | null;
  archived: boolean;
}

export interface ItemRow extends Synced {
  company_id: string;
  name_hi: string;
  name_en: string;
  size: string;
  unit: Unit;
  price_paise: number;
  category: string;
  picture: string | null;
  needs_review: boolean;
  archived: boolean;
}

/** One price change, append-only: never edited or deleted (SPEC §3). */
export interface PriceChangeRow extends Synced {
  item_id: string;
  old_paise: number;
  new_paise: number;
}

/** A saved bill. Never edited or deleted; a void is a separate record (SPEC §4). */
export interface BillRow extends Synced {
  bill_no: string;
  customer_id: string | null;
  total_paise: number;
  kind: 'sale' | 'return';
  linked_bill_id: string | null;
}

/** One line of a saved bill, with the item's name and price as they were at the sale. */
export interface BillLineRow {
  id: string;
  device_id: string;
  bill_id: string;
  item_id: string;
  name: string;
  /** Thousandths of a unit (2.5 kg = 2500), so no float ever touches money. The server's qty is numeric(10,3). */
  qty_milli: number;
  unit_price_paise: number;
  line_total_paise: number;
  created_at: string;
  server_at: string | null;
}

/** A compressed photo, kept under the same path it gets in cloud storage. Bytes, not a Blob, because Blobs in IndexedDB are unreliable on some phones. */
export interface PictureRow {
  path: string;
  bytes: ArrayBuffer;
  type: string;
  created_at: string;
}

export type OutboxEntry =
  | { seq?: number; table: 'companies'; row: CompanyRow; queued_at: string }
  | { seq?: number; table: 'items'; row: ItemRow; queued_at: string }
  | { seq?: number; table: 'price_changes'; row: PriceChangeRow; queued_at: string }
  // Points at the pictures table instead of copying the photo into the queue.
  | { seq?: number; table: 'pictures'; path: string; queued_at: string };
