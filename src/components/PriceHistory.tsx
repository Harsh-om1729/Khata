import { priceHistory } from '../db';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { timeAgo } from '../i18n/time-ago';
import { formatRupees } from '../money';
import { useServices } from '../services';
import { Alert } from './Alert';

export function PriceHistory({ itemId }: { itemId: string }) {
  const { t, lang } = useI18n();
  const { db, staffDirectory } = useServices();
  const history = useLiveQuery(() => priceHistory(db, itemId), [db, itemId]);
  const names = new Map(staffDirectory.cached().map((m) => [m.id, m.name]));

  return (
    <section class="price-history">
      <h3>{t.priceHistory}</h3>
      {history.failed && <Alert text={t.loadFailed} />}
      {history.value?.length === 0 && <p class="hint">{t.priceHistoryEmpty}</p>}
      <ul class="phone-list">
        {history.value?.map((change) => (
          <li key={change.id} class="phone" data-testid="price-change">
            <strong>
              {formatRupees(change.old_paise)} → {formatRupees(change.new_paise)}
            </strong>
            <span>
              {names.get(change.staff_id) ?? t.unknownStaff} · {timeAgo(change.created_at, lang)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
