import { putWithOutbox, type Author, type BillLineRow, type BillRow, type KhataDb, type PaymentRow, type Write } from '../db';
import { nextBillNo } from './bill-number';
import type { DraftBill } from './draft';
import { billRecords } from './records';

export interface SavedBill {
  bill: BillRow;
  lines: BillLineRow[];
  payment: PaymentRow | null;
}

/**
 * Saves a cash bill: bill number, bill, lines, payment and their outbox entries in one IndexedDB
 * transaction. If the app is killed part way, none of it is kept (DATA-SAFETY §4 test 1).
 */
export async function saveCashBill(db: KhataDb, author: Author, deviceCode: string | null, draft: DraftBill, now = new Date()): Promise<SavedBill> {
  return db.transaction('rw', db.allTables(), async () => {
    const billNo = await nextBillNo(db, deviceCode, now);
    const { bill, lines } = billRecords(draft, author, billNo, now);
    // The server refuses a zero payment, so a ₹0 bill has none.
    const payment: PaymentRow | null =
      bill.total_paise > 0
        ? {
            id: crypto.randomUUID(),
            device_id: bill.device_id,
            staff_id: bill.staff_id,
            created_at: bill.created_at,
            server_at: null,
            bill_id: bill.id,
            customer_id: null,
            method: 'cash',
            type: 'sale',
            amount_paise: bill.total_paise,
          }
        : null;
    // Bill first, then its lines and payment, so the cloud always receives them in an order it accepts.
    const writes: Write[] = [{ table: 'bills', row: bill }, ...lines.map((row): Write => ({ table: 'bill_lines', row }))];
    if (payment) writes.push({ table: 'payments', row: payment });
    await putWithOutbox(db, writes, now);
    return { bill, lines, payment };
  });
}
