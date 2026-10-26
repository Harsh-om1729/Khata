import { useState } from 'preact/hooks';
import { useOwnerAuth } from '../auth';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n';

export function OwnerHome({ email, onSignedOut }: { email: string; onSignedOut: () => void }) {
  const { t } = useI18n();
  const auth = useOwnerAuth();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    await auth.signOut();
    onSignedOut();
  };

  return (
    <main class="screen">
      <h1>{t.owner}</h1>
      <p>
        {t.signedInAs} <strong>{email}</strong>
      </p>
      <button type="button" class="btn" onClick={signOut} disabled={busy}>
        <Icon name="logout" />
        {t.signOut}
      </button>
    </main>
  );
}
