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

export type SettingField = 'shop_name' | 'gstin' | 'phone1' | 'phone2' | 'address' | 'pincode' | 'state' | 'overdue_days' | 'upi_qr';

/** One settings change, append-only. The phone keeps no settings row; it reads the newest change per field. The server fills in the old value. */
export interface SettingsChangeRow extends Synced {
  field: SettingField;
  new_value: string | null;
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

/** Every money movement is one row (PLAN §3). Never edited or deleted. */
export interface PaymentRow extends Synced {
  bill_id: string | null;
  customer_id: string | null;
  method: 'cash' | 'upi' | 'udhaar';
  type: 'sale' | 'repayment' | 'opening';
  amount_paise: number;
}

/** The last bill number used on this phone for one day. Kept forever, so a number is never given twice. */
export interface BillCounterRow {
  day: string;
  last: number;
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
  | { seq?: number; table: 'bills'; row: BillRow; queued_at: string }
  | { seq?: number; table: 'bill_lines'; row: BillLineRow; queued_at: string }
  | { seq?: number; table: 'payments'; row: PaymentRow; queued_at: string }
  | { seq?: number; table: 'settings_changes'; row: SettingsChangeRow; queued_at: string }
  // Points at the pictures table instead of copying the photo into the queue.
  | { seq?: number; table: 'pictures'; path: string; queued_at: string };
