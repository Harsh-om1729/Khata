import { useState } from 'preact/hooks';
import { BillHistory } from '../components/BillHistory';
import { BillReceipt } from '../components/BillReceipt';

export function OldBills({ onBack }: { onBack: () => void }) {
  const [billId, setBillId] = useState<string | null>(null);
  return billId ? <BillReceipt billId={billId} onClose={() => setBillId(null)} /> : <BillHistory onBack={onBack} onOpen={setBillId} />;
}
