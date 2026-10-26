import { useEffect, useState } from 'preact/hooks';
import type { DeviceRow } from '../auth';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { useI18n } from '../i18n';
import type { Messages } from '../i18n';
import { useServices } from '../services';
import { registrationCode } from '../sync/device-code';
import type { DeviceStatus } from '../sync/device-registration';

const statusLook: Record<DeviceStatus, { icon: IconName; text: keyof Messages }> = {
  pending: { icon: 'clock', text: 'statusPending' },
  approved: { icon: 'check', text: 'statusApproved' },
  revoked: { icon: 'block', text: 'statusRevoked' },
};

// Pending phones first, so a new staff phone is at the top when the owner opens the list.
const order: Record<DeviceStatus, number> = { pending: 0, approved: 1, revoked: 2 };

export function OwnerDevices() {
  const { t } = useI18n();
  const { deviceAdmin } = useServices();
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const reload = async () => {
    try {
      const list = await deviceAdmin.list();
      setRows([...list].sort((a, b) => order[a.status] - order[b.status]));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const run = async (deviceId: string, action: (id: string) => Promise<void>) => {
    setBusyId(deviceId);
    setConfirmId(null);
    setActionFailed(false);
    try {
      await action(deviceId);
    } catch {
      setActionFailed(true);
    }
    await reload();
    setBusyId(null);
  };

  const actions = (row: DeviceRow) => {
    const busy = busyId === row.id;
    if (confirmId === row.id) {
      return (
        <div class="row-actions">
          <button type="button" class="btn btn--danger" disabled={busy} onClick={() => void run(row.id, deviceAdmin.revoke)}>
            <Icon name="block" />
            {t.confirmRevoke}
          </button>
          <button type="button" class="btn" onClick={() => setConfirmId(null)}>
            {t.cancel}
          </button>
        </div>
      );
    }
    const approve = (label: string) => (
      <button type="button" class="btn btn--primary-inline" disabled={busy} onClick={() => void run(row.id, deviceAdmin.approve)}>
        <Icon name="check" />
        {label}
      </button>
    );
    const askRevoke = (label: string) => (
      <button type="button" class="btn" disabled={busy} onClick={() => setConfirmId(row.id)}>
        <Icon name="block" />
        {label}
      </button>
    );
    if (row.status === 'pending') {
      return (
        <div class="row-actions">
          {approve(t.approve)}
          {askRevoke(t.reject)}
        </div>
      );
    }
    if (row.status === 'approved') return <div class="row-actions">{askRevoke(t.revoke)}</div>;
    return <div class="row-actions">{approve(t.approveAgain)}</div>;
  };

  return (
    <section class="phones">
      <h2>
        <Icon name="phone" /> {t.phones}
      </h2>
      {loadFailed && (
        <p class="alert" role="alert">
          <Icon name="warning" />
          {t.phonesLoadError}
        </p>
      )}
      {actionFailed && (
        <p class="alert" role="alert">
          <Icon name="warning" />
          {t.actionFailed}
        </p>
      )}
      {rows?.length === 0 && <p>{t.phonesEmpty}</p>}
      <ul class="phone-list">
        {rows?.map((row) => {
          const look = statusLook[row.status];
          return (
            <li key={row.id} class={`phone phone--${row.status}`} data-testid="phone-row">
              <strong class="phone__code">{registrationCode(row.id)}</strong>
              <span class="phone__status">
                <Icon name={look.icon} />
                <span>{t[look.text]}</span>
                {row.code && (
                  <span>
                    · {t.billLetter} {row.code}
                  </span>
                )}
              </span>
              {actions(row)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
