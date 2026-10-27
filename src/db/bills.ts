import type { KhataDb } from './schema';
import type { BillLineRow, BillRow, PaymentRow } from './types';

export interface BillSummary {
  bill: BillRow;
  methods: PaymentRow['method'][];
}

export interface BillDetail {
  bill: BillRow;
  lines: BillLineRow[];
  payments: PaymentRow[];
}

/** This phone's bills, newest first. */
export async function recentBills(db: KhataDb, limit = 100): Promise<BillSummary[]> {
  const bills = await db.bills.orderBy('created_at').reverse().limit(limit).toArray();
  const payments = await db.payments.where('bill_id').anyOf(bills.map((b) => b.id)).toArray();
  return bills.map((bill) => ({
    bill,
    methods: [...new Set(payments.filter((p) => p.bill_id === bill.id).map((p) => p.method))],
  }));
}

export async function billDetail(db: KhataDb, billId: string): Promise<BillDetail | null> {
  const bill = await db.bills.get(billId);
  if (!bill) return null;
  // Line times are a millisecond apart in the order they were added (see billRecords).
  const lines = await db.bill_lines.where('bill_id').equals(billId).sortBy('created_at');
  const payments = await db.payments.where('bill_id').equals(billId).toArray();
  return { bill, lines, payments };
}
