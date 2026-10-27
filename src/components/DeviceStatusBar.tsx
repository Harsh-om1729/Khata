import { useEffect, useState } from 'preact/hooks';
import { useI18n } from '../i18n';
import { useServices } from '../services';
import { registrationCode } from '../sync/device-code';
import { RegistrationRefusedError } from '../sync/device-registration';
import type { DeviceInfo } from '../sync/device-registration';
import { Icon } from './Icon';

const POLL_MS = 30_000;

type View = { kind: 'checking' } | { kind: 'needInternet' } | { kind: 'refused' } | { kind: 'known'; info: DeviceInfo };

export function DeviceStatusBar() {
  const { t } = useI18n();
  const { device } = useServices();
  const [view, setView] = useState<View>(() => {
    const cached = device.cached();
    return cached ? { kind: 'known', info: cached } : { kind: 'checking' };
  });
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    try {
      setView({ kind: 'known', info: await device.refresh() });
    } catch (error) {
      // Keep the last known status if there is one; otherwise say whether it is the internet
      // or the server, so staff do not keep toggling mobile data for a server-side problem.
      const fallback: View = error instanceof RegistrationRefusedError ? { kind: 'refused' } : { kind: 'needInternet' };
      setView((current) => (current.kind === 'known' ? current : fallback));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void check();
  }, []);

  const pending = view.kind === 'known' && view.info.status === 'pending';
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void check(), POLL_MS);
    return () => clearInterval(timer);
  }, [pending]);

  const checkAgain = (
    <button type="button" class="btn" onClick={() => void check()} disabled={busy}>
      <Icon name="refresh" />
      {t.checkAgain}
    </button>
  );

  if (view.kind === 'checking') {
    return (
      <section class="device" role="status">
        <Icon name="clock" />
        <span>{t.deviceChecking}</span>
      </section>
    );
  }
  if (view.kind === 'refused') {
    return (
      <section class="device device--warn" role="status">
        <Icon name="block" />
        <span>{t.deviceRefused}</span>
        {checkAgain}
      </section>
    );
  }
  if (view.kind === 'needInternet') {
    return (
      <section class="device device--warn" role="status">
        <Icon name="warning" />
        <span>{t.deviceNeedInternet}</span>
        {checkAgain}
      </section>
    );
  }

  const { info } = view;
  // Always shown, so the owner can match this phone in his list whatever its status.
  const codeLine = (
    <span class="device__code-small">
      {t.thisPhoneCode} <strong>{registrationCode(info.id)}</strong>
      {info.code && ` · ${t.billLetter} ${info.code}`}
    </span>
  );
  if (info.status === 'approved') {
    return (
      <section class="device device--ok" role="status">
        <Icon name="check" />
        <span>
          {t.deviceApproved} ({info.code})
        </span>
        {codeLine}
      </section>
    );
  }
  if (info.status === 'revoked') {
    return (
      <section class="device device--warn" role="status">
        <Icon name="block" />
        <span>{t.deviceRevoked}</span>
        {codeLine}
        {checkAgain}
      </section>
    );
  }
  return (
    <section class="device device--warn" role="status">
      <Icon name="clock" />
      <span>{t.devicePending}</span>
      <strong class="device__code">{registrationCode(info.id)}</strong>
      {checkAgain}
    </section>
  );
}
