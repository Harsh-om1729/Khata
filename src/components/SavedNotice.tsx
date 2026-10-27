import type { BillRow } from '../db';
import { useI18n } from '../i18n';
import { formatRupees } from '../money';
import { Icon } from './Icon';

/** Shown on the staff tiles after a bill is saved. Says "on this phone": it is not safe in the cloud until sync confirms it. */
export function SavedNotice({ bill }: { bill: BillRow }) {
  const { t } = useI18n();
  return (
    <p class="done" role="status" data-testid="saved-notice">
      <Icon name="check" />
      <span>
        {t.billSavedOnPhone} {t.billNo} <strong class="nowrap">{bill.bill_no}</strong> · <strong>{formatRupees(bill.total_paise)}</strong>
      </span>
    </p>
  );
}
