import { useState } from 'preact/hooks';
import { DuplicateError, createItem, createItemWithCompany, type CompanyRow, type ItemRow, type Unit } from '../db';
import { useI18n } from '../i18n';
import { parseRupees } from '../money';
import { useObjectUrl } from '../pictures/use-object-url';
import { useServices } from '../services';
import { useAuthor } from '../staff/use-author';
import { Alert } from './Alert';
import { CompanyChoice, NEW_COMPANY } from './CompanyChoice';
import { Icon } from './Icon';
import { PhotoButton } from './PhotoButton';
import { UnitPicker } from './UnitPicker';

interface Props {
  /** null when adding from billing outside a company: the form then asks which company. */
  company: CompanyRow | null;
  onSaved: (item: ItemRow) => void;
  onCancel: () => void;
  /** e.g. what was typed in search before "Not in list? Add new". */
  initialName?: string;
  title?: string;
}

const isHindi = (text: string) => /[\u0900-\u097F]/.test(text);

export function AddItemForm({ company, onSaved, onCancel, initialName = '', title }: Props) {
  const { t } = useI18n();
  const { db } = useServices();
  const author = useAuthor();
  const [nameHi, setNameHi] = useState(isHindi(initialName) ? initialName.trim() : '');
  const [nameEn, setNameEn] = useState(isHindi(initialName) ? '' : initialName.trim());
  const [companyId, setCompanyId] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [size, setSize] = useState('');
  const [unit, setUnit] = useState<Unit>('piece');
  const [price, setPrice] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const photoUrl = useObjectUrl(photo);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (event: Event) => {
    event.preventDefault();
    if (!company && (companyId === '' || (companyId === NEW_COMPANY && newCompany.trim() === ''))) return setError(t.errorChooseCompany);
    if (nameHi.trim() === '' && nameEn.trim() === '') return setError(t.errorItemName);
    const paise = parseRupees(price);
    if (paise === null) return setError(t.errorPrice);
    const input = { name_hi: nameHi, name_en: nameEn, size, unit, price_paise: paise };
    setBusy(true);
    try {
      const chosen = company?.id ?? (companyId === NEW_COMPANY ? null : companyId);
      onSaved(
        chosen
          ? await createItem(db, author, { ...input, company_id: chosen }, photo ?? undefined)
          : await createItemWithCompany(db, author, newCompany, input, photo ?? undefined),
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
      <h2>{company ? `${title ?? t.addItem} · ${company.name}` : (title ?? t.addItem)}</h2>
      {error && <Alert text={error} />}
      {!company && <CompanyChoice value={companyId} newName={newCompany} onChange={setCompanyId} onNewName={setNewCompany} />}
      <p class="hint">{t.itemNameHint}</p>
      <label class="field">
        {t.itemNameHi}
        <input lang="hi" maxLength={80} autoFocus={company !== null} value={nameHi} onInput={(e) => setNameHi(e.currentTarget.value)} />
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
      <div class="photo-field">
        {photoUrl && <img class="photo-preview" src={photoUrl} alt={t.photoAdded} />}
        <PhotoButton label={photo ? t.changePhoto : t.takePhoto} onPhoto={setPhoto} />
      </div>
      <button type="submit" class="btn btn--primary" disabled={busy}>
        <Icon name="check" />
        {t.save}
      </button>
    </form>
  );
}
