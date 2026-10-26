import { useEffect, useState } from 'preact/hooks';
import { useI18n } from '../i18n';
import { useServices } from '../services';
import { registrationCode } from '../sync/device-code';
import type { DeviceInfo } from '../sync/device-registration';
import { Icon } from './Icon';

const POLL_MS = 30_000;

type View = { kind: 'checking' } | { kind: 'needInternet' } | { kind: 'known'; info: DeviceInfo };

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
    } catch {
      // Offline or server unreachable: keep the last known status if there is one.
      setView((current) => (current.kind === 'known' ? current : { kind: 'needInternet' }));
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
  if (info.status === 'approved') {
    return (
      <section class="device device--ok" role="status">
        <Icon name="check" />
        <span>
          {t.deviceApproved} ({info.code})
        </span>
      </section>
    );
  }
  if (info.status === 'revoked') {
    return (
      <section class="device device--warn" role="status">
        <Icon name="block" />
        <span>{t.deviceRevoked}</span>
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
