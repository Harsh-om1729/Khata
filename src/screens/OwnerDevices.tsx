import { useEffect, useState } from 'preact/hooks';
import type { DeviceRow } from '../auth';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { useI18n } from '../i18n';
import type { Messages } from '../i18n';
import { timeAgo } from '../i18n/time-ago';
import { useServices } from '../services';
import { registrationCode } from '../sync/device-code';
import type { DeviceStatus } from '../sync/device-registration';

const statusLook: Record<DeviceStatus, { icon: IconName; text: keyof Messages }> = {
  pending: { icon: 'clock', text: 'statusPending' },
  approved: { icon: 'check', text: 'statusApproved' },
  revoked: { icon: 'block', text: 'statusRevoked' },
};

export function OwnerDevices() {
  const { t, lang } = useI18n();
  const { deviceAdmin, device } = useServices();
  const thisPhoneId = device.cached()?.id ?? null;
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [showOff, setShowOff] = useState(false);

  const reload = async () => {
    try {
      setRows(await deviceAdmin.list());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const run = async (deviceId: string, action: () => Promise<void>) => {
    setBusyId(deviceId);
    setConfirmId(null);
    setActionFailed(false);
    try {
      await action();
      setRenameId(null);
    } catch {
      setActionFailed(true);
    }
    await reload();
    setBusyId(null);
  };

  const actions = (row: DeviceRow) => {
    const busy = busyId === row.id;
    if (renameId === row.id) {
      return (
        <div class="row-actions">
          <label class="field">
            {t.phoneName}
            <input maxLength={60} value={newName} onInput={(e) => setNewName(e.currentTarget.value)} />
          </label>
          <button
            type="button"
            class="btn btn--primary-inline"
            disabled={busy || newName.trim() === ''}
            onClick={() => void run(row.id, () => deviceAdmin.rename(row.id, newName))}
          >
            <Icon name="check" />
            {t.saveName}
          </button>
          <button type="button" class="btn" onClick={() => setRenameId(null)}>
            {t.cancel}
          </button>
        </div>
      );
    }
    if (confirmId === row.id) {
      return (
        <div class="row-actions">
          <button
            type="button"
            class="btn btn--danger"
            disabled={busy}
            onClick={() => void run(row.id, () => deviceAdmin.revoke(row.id))}
          >
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
      <button
        type="button"
        class="btn btn--primary-inline"
        disabled={busy}
        onClick={() => void run(row.id, () => deviceAdmin.approve(row.id))}
      >
        <Icon name="check" />
        {label}
      </button>
    );
    // The owner must not lock himself out of the phone he is holding.
    const askRevoke = (label: string) =>
      row.id === thisPhoneId ? null : (
        <button type="button" class="btn" disabled={busy} onClick={() => setConfirmId(row.id)}>
          <Icon name="block" />
          {label}
        </button>
      );
    const rename = (
      <button
        type="button"
        class="btn"
        disabled={busy}
        onClick={() => {
          setNewName(row.name);
          setRenameId(row.id);
        }}
      >
        <Icon name="edit" />
        {t.rename}
      </button>
    );

    return (
      <div class="row-actions">
        {row.status === 'pending' && approve(t.approve)}
        {row.status === 'revoked' && approve(t.approveAgain)}
        {row.status === 'pending' && askRevoke(t.reject)}
        {row.status === 'approved' && askRevoke(t.revoke)}
        {rename}
      </div>
    );
  };

  const card = (row: DeviceRow) => {
    const look = statusLook[row.status];
    return (
      <li key={row.id} class={`phone phone--${row.status}`} data-testid="phone-row">
        <div class="phone__head">
          <strong class="phone__name">{row.name}</strong>
          {row.id === thisPhoneId && <span class="tag">{t.thisPhone}</span>}
        </div>
        <span class="phone__code">{registrationCode(row.id)}</span>
        <span class="phone__status">
          <Icon name={look.icon} />
          <span>{t[look.text]}</span>
          {row.code && (
            <span>
              · {t.billLetter} {row.code}
            </span>
          )}
        </span>
        <span class="phone__seen">
          {t.lastSeen} {row.last_seen ? timeAgo(row.last_seen, lang) : t.lastSeenNever}
        </span>
        {actions(row)}
      </li>
    );
  };

  // Pending phones first, so a new staff phone is at the top when the owner opens the list.
  const active = (rows ?? [])
    .filter((r) => r.status !== 'revoked')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1));
  const turnedOff = (rows ?? []).filter((r) => r.status === 'revoked');

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
      <ul class="phone-list">{active.map(card)}</ul>
      {turnedOff.length > 0 && (
        <section class="phones-off">
          <button
            type="button"
            class="btn phones-off__toggle"
            aria-expanded={showOff}
            onClick={() => setShowOff(!showOff)}
          >
            <Icon name="chevron" />
            {t.phonesTurnedOff} ({turnedOff.length})
          </button>
          {showOff && <ul class="phone-list">{turnedOff.map(card)}</ul>}
        </section>
      )}
    </section>
  );
}
