import type { PaymentRow } from '../db';
import type { Messages } from './types';

export function payMethodLabel(t: Messages, method: PaymentRow['method']): string {
  return { cash: t.payCash, upi: t.payUpi, udhaar: t.payUdhaar }[method];
}
