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

export type OutboxEntry =
  | { seq?: number; table: 'companies'; row: CompanyRow; queued_at: string }
  | { seq?: number; table: 'items'; row: ItemRow; queued_at: string };
