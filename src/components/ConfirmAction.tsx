import { useState } from 'preact/hooks';
import { useI18n } from '../i18n';
import { Alert } from './Alert';
import { Icon, type IconName } from './Icon';

interface Props {
  label: string;
  question: string;
  icon: IconName;
  onConfirm: () => Promise<void>;
}

/** A button that asks once more before doing it. */
export function ConfirmAction({ label, question, icon, onConfirm }: Props) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!asking) {
    return (
      <button type="button" class="btn btn--quiet-danger" onClick={() => setAsking(true)}>
        <Icon name={icon} />
        {label}
      </button>
    );
  }
  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onConfirm();
      setAsking(false);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };
  return (
    <div class="confirm" role="group" aria-label={label}>
      <p class="confirm__question">
        <Icon name="warning" />
        {question}
      </p>
      {failed && <Alert text={t.saveFailed} />}
      <div class="row-actions">
        <button type="button" class="btn btn--danger" disabled={busy} onClick={confirm}>
          <Icon name={icon} />
          {label}
        </button>
        <button type="button" class="btn" disabled={busy} onClick={() => setAsking(false)}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
