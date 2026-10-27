import type { ItemRow } from '../db';
import { ONE, lineTotal } from './qty';

/** A line on the bill being made. Name and price are copied from the item when added, so later edits to the item never change it. */
export interface DraftLine {
  id: string;
  item_id: string;
  name: string;
  unit: ItemRow['unit'];
  /** The item's default price when added; a different unit price means it was changed for this sale only. */
  default_price_paise: number;
  unit_price_paise: number;
  qty_milli: number;
}

export interface DraftBill {
  lines: DraftLine[];
}

export const emptyBill = (): DraftBill => ({ lines: [] });

/** Hindi first (UI-VOICE §1), with the size so "50kg" and "25kg" are told apart on old bills. */
export function snapshotName(item: Pick<ItemRow, 'name_hi' | 'name_en' | 'size'>): string {
  return [item.name_hi || item.name_en, item.size].filter(Boolean).join(' ');
}

/** Adds one of the item; tapping an item already on the bill adds one more to that line. */
export function addItem(bill: DraftBill, item: ItemRow): DraftBill {
  const existing = bill.lines.find((l) => l.item_id === item.id);
  if (existing) return setQty(bill, existing.id, existing.qty_milli + ONE);
  const line: DraftLine = {
    id: crypto.randomUUID(),
    item_id: item.id,
    name: snapshotName(item),
    unit: item.unit,
    default_price_paise: item.price_paise,
    unit_price_paise: item.price_paise,
    qty_milli: ONE,
  };
  return { lines: [...bill.lines, line] };
}

function updateLine(bill: DraftBill, lineId: string, change: (line: DraftLine) => DraftLine): DraftBill {
  if (!bill.lines.some((l) => l.id === lineId)) throw new Error('line not on this bill');
  return { lines: bill.lines.map((l) => (l.id === lineId ? change(l) : l)) };
}

export function setQty(bill: DraftBill, lineId: string, qtyMilli: number): DraftBill {
  if (!Number.isSafeInteger(qtyMilli) || qtyMilli <= 0) throw new Error('quantity must be more than 0');
  return updateLine(bill, lineId, (l) => ({ ...l, qty_milli: qtyMilli }));
}

/** Changes the price for this sale only (SPEC §3). */
export function setLinePrice(bill: DraftBill, lineId: string, pricePaise: number): DraftBill {
  if (!Number.isSafeInteger(pricePaise) || pricePaise < 0) throw new Error('price must be whole paise, 0 or more');
  return updateLine(bill, lineId, (l) => ({ ...l, unit_price_paise: pricePaise }));
}

export function removeLine(bill: DraftBill, lineId: string): DraftBill {
  return { lines: bill.lines.filter((l) => l.id !== lineId) };
}

export const isPriceChanged = (line: DraftLine): boolean => line.unit_price_paise !== line.default_price_paise;

export const draftLineTotal = (line: DraftLine): number => lineTotal(line.unit_price_paise, line.qty_milli);

export function billTotal(bill: DraftBill): number {
  const total = bill.lines.reduce((sum, line) => sum + draftLineTotal(line), 0);
  if (!Number.isSafeInteger(total)) throw new Error('bill total too large');
  return total;
}
