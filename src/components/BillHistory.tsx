import { recentBills } from '../db/bills';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { dateTime } from '../i18n/date-time';
import { payMethodLabel } from '../i18n/pay-method';
import { formatRupees } from '../money';
import { useServices } from '../services';
import { Alert } from './Alert';
import { Icon } from './Icon';

export function BillHistory({ onOpen, onBack }: { onOpen: (billId: string) => void; onBack: () => void }) {
  const { t, lang } = useI18n();
  const { db, staffDirectory } = useServices();
  const bills = useLiveQuery(() => recentBills(db), [db]);
  const staff = new Map(staffDirectory.cached().map((m) => [m.id, m.name]));

  return (
    <section class="catalog">
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={onBack}>
          <Icon name="back" />
          {t.back}
        </button>
      </header>
      <h2>{t.billHistory}</h2>
      {bills.failed && <Alert text={t.loadFailed} />}
      {bills.value?.length === 0 && <p class="hint">{t.billHistoryEmpty}</p>}
      <ul class="phone-list">
        {bills.value?.map(({ bill, methods }) => (
          <li key={bill.id}>
            <button type="button" class="history-row" data-testid="history-row" onClick={() => onOpen(bill.id)}>
              <span class="history-row__top">
                <strong class="nowrap">{bill.bill_no}</strong>
                <strong class="history-row__total">{formatRupees(bill.total_paise)}</strong>
              </span>
              <span>
                {dateTime(bill.created_at, lang)} · {staff.get(bill.staff_id) ?? t.unknownStaff}
                {methods.length > 0 && ` · ${methods.map((m) => payMethodLabel(t, m)).join(', ')}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
