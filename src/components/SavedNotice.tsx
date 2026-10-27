import type { BillRow } from '../db';
import { useI18n } from '../i18n';
import { formatRupees } from '../money';
import { Icon } from './Icon';

/** Shown on the staff tiles after a bill is saved. Says "on this phone": it is not safe in the cloud until sync confirms it. */
export function SavedNotice({ bill, onShow }: { bill: BillRow; onShow: () => void }) {
  const { t } = useI18n();
  return (
    <div class="done saved-notice" role="status" data-testid="saved-notice">
      <p>
        <Icon name="check" />
        <span>
          {t.billSavedOnPhone} {t.billNo} <strong class="nowrap">{bill.bill_no}</strong> · <strong>{formatRupees(bill.total_paise)}</strong>
        </span>
      </p>
      {/* Customers ask for the bill right after paying, when the phone has already locked. */}
      <button type="button" class="btn" onClick={onShow}>
        <Icon name="list" />
        {t.showBill}
      </button>
    </div>
  );
}
