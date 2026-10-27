import { useState } from 'preact/hooks';
import { DuplicateError, createItem, type CompanyRow, type ItemRow, type Unit } from '../db';
import { useI18n } from '../i18n';
import { parseRupees } from '../money';
import { useServices } from '../services';
import { useAuthor } from '../staff/use-author';
import { Alert } from './Alert';
import { Icon } from './Icon';
import { UnitPicker } from './UnitPicker';

interface Props {
  company: CompanyRow;
  onSaved: (item: ItemRow) => void;
  onCancel: () => void;
}

export function AddItemForm({ company, onSaved, onCancel }: Props) {
  const { t } = useI18n();
  const { db } = useServices();
  const author = useAuthor();
  const [nameHi, setNameHi] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [size, setSize] = useState('');
  const [unit, setUnit] = useState<Unit>('piece');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (event: Event) => {
    event.preventDefault();
    if (nameHi.trim() === '' && nameEn.trim() === '') return setError(t.errorItemName);
    const paise = parseRupees(price);
    if (paise === null) return setError(t.errorPrice);
    setBusy(true);
    try {
      onSaved(
        await createItem(db, author, { company_id: company.id, name_hi: nameHi, name_en: nameEn, size, unit, price_paise: paise }),
      );
    } catch (e) {
      setError(e instanceof DuplicateError ? t.errorDuplicateItem : t.saveFailed);
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
      <h2>
        {t.addItem} · {company.name}
      </h2>
      {error && <Alert text={error} />}
      <p class="hint">{t.itemNameHint}</p>
      <label class="field">
        {t.itemNameHi}
        <input lang="hi" maxLength={80} autoFocus value={nameHi} onInput={(e) => setNameHi(e.currentTarget.value)} />
      </label>
      <label class="field">
        {t.itemNameEn}
        <input lang="en" maxLength={80} value={nameEn} onInput={(e) => setNameEn(e.currentTarget.value)} />
      </label>
      <label class="field">
        {t.itemSize}
        <input maxLength={40} value={size} onInput={(e) => setSize(e.currentTarget.value)} />
      </label>
      <UnitPicker value={unit} onChange={setUnit} />
      <label class="field">
        {t.itemPrice}
        <input inputMode="decimal" maxLength={12} value={price} onInput={(e) => setPrice(e.currentTarget.value)} />
      </label>
      <button type="submit" class="btn btn--primary" disabled={busy}>
        <Icon name="check" />
        {t.save}
      </button>
    </form>
  );
}
