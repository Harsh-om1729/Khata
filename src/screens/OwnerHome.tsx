import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n';
import { useServices } from '../services';
import { OwnerDevices } from './OwnerDevices';
import { OwnerStaff } from './OwnerStaff';

export function OwnerHome({ email, onSignedOut, onBack }: { email: string; onSignedOut: () => void; onBack: () => void }) {
  const { t } = useI18n();
  const { ownerAuth } = useServices();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    await ownerAuth.signOut();
    onSignedOut();
  };

  return (
    <main class="screen">
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={onBack}>
          <Icon name="back" />
          {t.back}
        </button>
      </header>
      <h1>{t.owner}</h1>
      <p>
        {t.signedInAs} <strong>{email}</strong>
      </p>
      <OwnerDevices />
      <OwnerStaff />
      <button type="button" class="btn" onClick={signOut} disabled={busy}>
        <Icon name="logout" />
        {t.signOut}
      </button>
    </main>
  );
}
