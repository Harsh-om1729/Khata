import { billTotal, type DraftBill } from '../bill';
import { useI18n } from '../i18n';
import { formatRupees } from '../money';
import { Icon } from './Icon';

interface Props {
  bill: DraftBill;
  canUndo: boolean;
  onUndo: () => void;
}

/** Always on screen while billing: how many items, the running total in large digits, and undo. */
export function BillStrip({ bill, canUndo, onUndo }: Props) {
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
      <button type="button" class="btn" disabled={!canUndo} onClick={onUndo}>
        <Icon name="undo" />
        {t.undo}
      </button>
    </aside>
  );
}
