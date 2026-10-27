import { useRef, useState } from 'preact/hooks';
import { NoBillLetterError, billTotal, type DraftBill } from '../bill';
import { useI18n } from '../i18n';
import { formatRupees } from '../money';
import { Alert } from './Alert';
import { Icon } from './Icon';

interface Props {
  bill: DraftBill;
  onBack: () => void;
  /** Rejects when the bill could not be saved; the screen then lets the person try again. */
  onSave: () => Promise<void>;
}

/** Total in large digits, the payment, and Save. Also the confirm step: a saved bill can only be voided, never edited. */
export function PayScreen({ bill, onBack, onSave }: Props) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A ref, not only state, so a fast double tap can never save the bill twice.
  const saving = useRef(false);

  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave();
    } catch (e) {
      setError(e instanceof NoBillLetterError ? t.errorNoLetter : t.saveFailed);
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <section class="catalog pay">
      <header class="bar bar--start">
        <button type="button" class="btn" disabled={busy} onClick={onBack}>
          <Icon name="back" />
          {t.backToBill}
        </button>
      </header>
      <h2>{t.payTitle}</h2>
      <p class="pay__total" data-testid="pay-total">
        {formatRupees(billTotal(bill))}
      </p>
      <p class="pay__lines">
        {bill.lines.length} {t.billItems}
      </p>
      <fieldset class="units">
        <legend>{t.payMethod}</legend>
        <label class="unit">
          <input type="radio" name="method" checked readOnly />
          {t.payCash}
        </label>
      </fieldset>
      {error && <Alert text={error} />}
      <button type="button" class="btn btn--primary btn--big" disabled={busy} onClick={() => void save()}>
        <Icon name="check" />
        {busy ? t.saving : t.saveBill}
      </button>
    </section>
  );
}
