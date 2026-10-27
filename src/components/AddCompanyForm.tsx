import { useState } from 'preact/hooks';
import { DuplicateError, createCompany, type CompanyRow } from '../db';
import { useI18n } from '../i18n';
import { useServices } from '../services';
import { useAuthor } from '../staff/use-author';
import { Alert } from './Alert';
import { Icon } from './Icon';

export function AddCompanyForm({ onSaved, onCancel }: { onSaved: (company: CompanyRow) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const { db } = useServices();
  const author = useAuthor();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (event: Event) => {
    event.preventDefault();
    if (name.trim() === '') return setError(t.errorCompanyName);
    setBusy(true);
    try {
      onSaved(await createCompany(db, author, { name }));
    } catch (e) {
      setError(e instanceof DuplicateError ? t.errorDuplicateCompany : t.saveFailed);
      setBusy(false);
    }
  };

  return (
    <form class="form" onSubmit={save}>
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={onCancel}>
          <Icon name="back" />
          {t.back}
        </button>
      </header>
      <h2>{t.addCompany}</h2>
      {error && <Alert text={error} />}
      <label class="field">
        {t.companyName}
        <input maxLength={80} autoFocus value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </label>
      <button type="submit" class="btn btn--primary" disabled={busy}>
        <Icon name="check" />
        {t.save}
      </button>
    </form>
  );
}
