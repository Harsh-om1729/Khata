import { useEffect, useState } from 'preact/hooks';
import { useLiveQuery } from '../db/live';
import { isOld, unsyncedBills } from '../db/unsynced';
import { useI18n } from '../i18n';
import { timeAgo } from '../i18n/time-ago';
import { useServices } from '../services';
import { Icon } from './Icon';

const MINUTE = 60_000;

/** Phone storage is a working copy, not a backup (DATA-SAFETY §1). These say so before anything is lost. */
export function StorageWarnings() {
  const { t, lang } = useI18n();
  const { db, storage } = useServices();
  const [kept, setKept] = useState<boolean | null>(null);
  const [now, setNow] = useState(Date.now);
  const unsynced = useLiveQuery(() => unsyncedBills(db), [db]);

  useEffect(() => {
    storage.persist().then(setKept, () => setKept(false));
    // Bills become "old" with time, not only when the database changes.
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);

  const old = unsynced.value && isOld(unsynced.value, now) ? unsynced.value : null;
  if (kept !== false && !old) return null;
  return (
    <div class="warnings">
      {kept === false && (
        <p class="warn" role="note" data-testid="storage-not-kept">
          <Icon name="warning" />
          <span>{t.storageNotKept}</span>
        </p>
      )}
      {old?.oldest && (
        <p class="warn" role="note" data-testid="unsynced-old">
          <Icon name="warning" />
          <span>
            <strong>
              {old.count} {t.billsOnlyOnPhone}
            </strong>{' '}
            {t.oldestBill} {timeAgo(old.oldest, lang, now)}. {t.unsyncedHelp}
          </span>
        </p>
      )}
    </div>
  );
}
