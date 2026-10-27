import { billTotal, type DraftBill } from '../bill';
import { useI18n } from '../i18n';
import { formatRupees } from '../money';
import { Icon } from './Icon';

interface Props {
  bill: DraftBill;
  canUndo: boolean;
  onUndo: () => void;
  /** Left out while the bill itself is on screen. */
  onReview?: () => void;
}

/** Always on screen while billing: how many items, the running total in large digits, undo, and the way to the bill. */
export function BillStrip({ bill, canUndo, onUndo, onReview }: Props) {
  const { t } = useI18n();
  const count = bill.lines.length;
  return (
    <aside class="bill-strip" aria-label={t.bill}>
      <div class="bill-strip__sum">
        <span data-testid="bill-count">{count === 0 ? t.billEmpty : `${count} ${t.billItems}`}</span>
        <strong class="bill-strip__total" data-testid="bill-total">
          {formatRupees(billTotal(bill))}
        </strong>
      </div>
      <div class="bill-strip__actions">
        <button type="button" class="btn" disabled={!canUndo} onClick={onUndo}>
          <Icon name="undo" />
          {t.undo}
        </button>
        {onReview && count > 0 && (
          <button type="button" class="btn btn--primary-inline" onClick={onReview}>
            <Icon name="list" />
            {t.seeBill}
          </button>
        )}
      </div>
    </aside>
  );
}
