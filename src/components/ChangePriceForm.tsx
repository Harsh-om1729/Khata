import { useState } from 'preact/hooks';
import { changePrice, type ItemRow } from '../db';
import { useI18n } from '../i18n';
import { parseRupees } from '../money';
import { useServices } from '../services';
import { useAuthor } from '../staff/use-author';
import { Alert } from './Alert';
import { Icon } from './Icon';

export function ChangePriceForm({ item }: { item: ItemRow }) {
  const { t } = useI18n();
  const { db } = useServices();
  const author = useAuthor();
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (event: Event) => {
    event.preventDefault();
    const paise = parseRupees(price);
    if (paise === null) return setError(t.errorPrice);
    if (paise === item.price_paise) return setError(t.priceSame);
    setBusy(true);
    setError(null);
    try {
      await changePrice(db, author, item.id, paise);
      setPrice('');
    } catch {
      setError(t.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="form" onSubmit={save}>
      {error && <Alert text={error} />}
      <label class="field">
        {t.newPrice}
        <input inputMode="decimal" maxLength={12} value={price} onInput={(e) => setPrice(e.currentTarget.value)} />
      </label>
      <button type="submit" class="btn btn--primary" disabled={busy}>
        <Icon name="edit" />
        {t.changePrice}
      </button>
    </form>
  );
}
