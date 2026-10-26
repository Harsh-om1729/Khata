import { useState } from 'preact/hooks';
import type { SignInResult } from '../auth';
import { useOwnerAuth } from '../auth';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n';
import type { Messages } from '../i18n';

const errorText: Record<Exclude<SignInResult, 'ok'>, keyof Messages> = {
  wrong: 'errorWrong',
  offline: 'errorOffline',
  notOwner: 'errorNotOwner',
};

export function OwnerLogin({ onBack, onSignedIn }: { onBack: () => void; onSignedIn: (email: string) => void }) {
  const { t } = useI18n();
  const auth = useOwnerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Exclude<SignInResult, 'ok'> | null>(null);

  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await auth.signIn(email, password);
    setBusy(false);
    if (result === 'ok') onSignedIn(email.trim());
    else setError(result);
  };

  return (
    <main class="screen">
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={onBack}>
          <Icon name="back" />
          {t.back}
        </button>
      </header>
      <h1>{t.ownerLoginTitle}</h1>
      <form class="form" onSubmit={submit}>
        <label class="field">
          {t.email}
          <input
            type="email"
            autocomplete="username"
            inputMode="email"
            required
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </label>
        <label class="field">
          {t.password}
          <input
            type="password"
            autocomplete="current-password"
            required
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </label>
        {error && (
          <p class="alert" role="alert">
            <Icon name="warning" />
            {t[errorText[error]]}
          </p>
        )}
        <button type="submit" class="btn btn--primary" disabled={busy}>
          {busy ? t.signingIn : t.signIn}
        </button>
      </form>
    </main>
  );
}
