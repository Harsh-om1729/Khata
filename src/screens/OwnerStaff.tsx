import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n';
import { useServices } from '../services';
import type { StaffMember } from '../staff/types';

const isPin = (value: string) => /^[0-9]{4}$/.test(value);

export function OwnerStaff() {
  const { t } = useI18n();
  const { staffAdmin } = useServices();
  const [members, setMembers] = useState<StaffMember[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [formatError, setFormatError] = useState(false);

  const reload = async () => {
    try {
      setMembers(await staffAdmin.list());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionFailed(false);
    try {
      await action();
      return true;
    } catch {
      setActionFailed(true);
      return false;
    } finally {
      await reload();
      setBusy(false);
    }
  };

  const add = async (event: Event) => {
    event.preventDefault();
    if (!isPin(pin)) return setFormatError(true);
    setFormatError(false);
    if (await run(() => staffAdmin.add({ name, pin, isOwner }))) {
      setName('');
      setPin('');
      setIsOwner(false);
    }
  };

  const savePin = async (staffId: string) => {
    if (!isPin(newPin)) return setFormatError(true);
    setFormatError(false);
    if (await run(() => staffAdmin.resetPin(staffId, newPin))) {
      setPinFor(null);
      setNewPin('');
    }
  };

  return (
    <section class="staff-admin">
      <h2>
        <Icon name="person" /> {t.staff}
      </h2>
      {loadFailed && (
        <p class="alert" role="alert">
          <Icon name="warning" />
          {t.staffLoadError}
        </p>
      )}
      {actionFailed && (
        <p class="alert" role="alert">
          <Icon name="warning" />
          {t.actionFailed}
        </p>
      )}
      {formatError && (
        <p class="alert" role="alert">
          <Icon name="warning" />
          {t.pinFormat}
        </p>
      )}
      <ul class="phone-list">
        {members?.map((member) => (
          <li key={member.id} class="phone" data-testid="staff-row">
            <strong>
              {member.name}
              {member.is_owner && ` · ${t.owner}`}
            </strong>
            {pinFor === member.id ? (
              <div class="row-actions">
                <label class="field">
                  {t.newPin}
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    autocomplete="off"
                    value={newPin}
                    onInput={(e) => setNewPin(e.currentTarget.value)}
                  />
                </label>
                <button type="button" class="btn btn--primary-inline" disabled={busy} onClick={() => void savePin(member.id)}>
                  <Icon name="key" />
                  {t.savePin}
                </button>
                <button type="button" class="btn" onClick={() => setPinFor(null)}>
                  {t.cancel}
                </button>
              </div>
            ) : confirmRemove === member.id ? (
              <div class="row-actions">
                <button
                  type="button"
                  class="btn btn--danger"
                  disabled={busy}
                  onClick={() => {
                    setConfirmRemove(null);
                    void run(() => staffAdmin.remove(member.id));
                  }}
                >
                  <Icon name="block" />
                  {t.confirmRemove}
                </button>
                <button type="button" class="btn" onClick={() => setConfirmRemove(null)}>
                  {t.cancel}
                </button>
              </div>
            ) : (
              <div class="row-actions">
                <button type="button" class="btn" disabled={busy} onClick={() => setPinFor(member.id)}>
                  <Icon name="key" />
                  {t.newPin}
                </button>
                <button type="button" class="btn" disabled={busy} onClick={() => setConfirmRemove(member.id)}>
                  <Icon name="block" />
                  {t.removeStaff}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form class="form" onSubmit={add}>
        <label class="field">
          {t.staffName}
          <input required maxLength={60} value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </label>
        <label class="field">
          {t.staffPin}
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            autocomplete="off"
            required
            value={pin}
            onInput={(e) => setPin(e.currentTarget.value)}
          />
        </label>
        <label class="check">
          <input type="checkbox" checked={isOwner} onChange={(e) => setIsOwner(e.currentTarget.checked)} />
          {t.staffIsMe}
        </label>
        <button type="submit" class="btn btn--primary" disabled={busy}>
          <Icon name="plus" />
          {t.addStaff}
        </button>
      </form>
    </section>
  );
}
