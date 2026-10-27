import { formatQty } from '../bill';
import { billDetail } from '../db/bills';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { dateTime } from '../i18n/date-time';
import { payMethodLabel } from '../i18n/pay-method';
import { formatRupees } from '../money';
import { useServices } from '../services';
import { Alert } from './Alert';
import { Icon } from './Icon';
import { ShopHeader } from './ShopHeader';

/** The on-screen bill a customer can see or screenshot (SPEC §4 step 8). Read only. */
export function BillReceipt({ billId, onClose }: { billId: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { db, staffDirectory } = useServices();
  const detail = useLiveQuery(() => billDetail(db, billId), [db, billId]);
  const staff = new Map(staffDirectory.cached().map((m) => [m.id, m.name]));
  const d = detail.value;

  return (
    <section class="catalog">
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={onClose}>
          <Icon name="back" />
          {t.close}
        </button>
      </header>
      {detail.failed && <Alert text={t.loadFailed} />}
      {d && (
        <article class="receipt" data-testid="receipt">
          <ShopHeader />
          <h2 class="receipt__title">{t.bill}</h2>
          <dl class="receipt__meta">
            <dt>{t.billNo}</dt>
            <dd class="nowrap">{d.bill.bill_no}</dd>
            <dt>{t.when}</dt>
            <dd>{dateTime(d.bill.created_at, lang)}</dd>
            <dt>{t.madeBy}</dt>
            <dd>{staff.get(d.bill.staff_id) ?? t.unknownStaff}</dd>
          </dl>
          <ul class="receipt__lines">
            {d.lines.map((line) => (
              <li key={line.id} data-testid="receipt-line">
                <span class="receipt__name">{line.name}</span>
                <span class="receipt__sum">
                  {formatQty(line.qty_milli)} × {formatRupees(line.unit_price_paise)} = <strong>{formatRupees(line.line_total_paise)}</strong>
                </span>
              </li>
            ))}
          </ul>
          <p class="receipt__total">
            <span>{t.total}</span>
            <strong data-testid="receipt-total">{formatRupees(d.bill.total_paise)}</strong>
          </p>
          {d.payments.map((p) => (
            <p key={p.id} class="receipt__paid">
              {payMethodLabel(t, p.method)}: {formatRupees(p.amount_paise)}
            </p>
          ))}
        </article>
      )}
    </section>
  );
}
