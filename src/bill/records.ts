import type { Author, BillLineRow, BillRow } from '../db';
import { stampRecord } from '../staff/stamp';
import { billTotal, draftLineTotal, type DraftBill } from './draft';

export interface BillRecords {
  bill: BillRow;
  lines: BillLineRow[];
}

/** Turns the bill being made into the rows that are saved and synced. The total is always the sum of the saved line totals. */
export function billRecords(draft: DraftBill, author: Author, billNo: string, now = new Date()): BillRecords {
  if (draft.lines.length === 0) throw new Error('a bill needs at least one line');
  const stamp = stampRecord(author.staff, author.deviceId, now);
  const bill: BillRow = {
    ...stamp,
    server_at: null,
    bill_no: billNo,
    customer_id: null,
    total_paise: billTotal(draft),
    kind: 'sale',
    linked_bill_id: null,
  };
  const lines = draft.lines.map(
    (line, index): BillLineRow => ({
      // Each saved line gets a fresh UUID; the draft's id is only for the screen.
      id: crypto.randomUUID(),
      device_id: stamp.device_id,
      bill_id: bill.id,
      item_id: line.item_id,
      name: line.name,
      qty_milli: line.qty_milli,
      unit_price_paise: line.unit_price_paise,
      line_total_paise: draftLineTotal(line),
      // One millisecond apart, so lines keep the order they were added in; there is no position column.
      created_at: new Date(now.getTime() + index).toISOString(),
      server_at: null,
    }),
  );
  return { bill, lines };
}
