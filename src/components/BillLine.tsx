import { useState } from 'preact/hooks';
import { ONE, draftLineTotal, formatQty, isPriceChanged, parseQty, type DraftLine } from '../bill';
import { useI18n } from '../i18n';
import { unitLabel } from '../i18n/unit-label';
import { formatRupees, parseRupees } from '../money';
import { Alert } from './Alert';
import { Icon } from './Icon';

interface Props {
  line: DraftLine;
  onQty: (qtyMilli: number) => void;
  onPrice: (pricePaise: number) => void;
  onRemove: () => void;
  /** Saves this line's price as the item's price; resolves once logged. */
  onMakeDefault: () => Promise<void>;
}

type Editing = { field: 'qty' | 'price'; text: string } | null;

export function BillLine({ line, onQty, onPrice, onRemove, onMakeDefault }: Props) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaultSaved, setDefaultSaved] = useState(false);
  const unit = unitLabel(t, line.unit);

  const save = (event: Event) => {
    event.preventDefault();
    if (!editing) return;
    if (editing.field === 'qty') {
      const qty = parseQty(editing.text);
      if (qty === null) return setError(t.errorQty);
      onQty(qty);
    } else {
      const price = parseRupees(editing.text);
      if (price === null) return setError(t.errorPrice);
      setDefaultSaved(false);
      onPrice(price);
    }
    setError(null);
    setEditing(null);
  };

  const makeDefault = async () => {
    try {
      await onMakeDefault();
      setDefaultSaved(true);
    } catch {
      setError(t.saveFailed);
    }
  };

  return (
    <li class="bill-line" data-testid="bill-line">
      <strong class="bill-line__name">{line.name}</strong>

      <div class="bill-line__qty">
        <button type="button" class="btn" aria-label={t.lessOne} disabled={line.qty_milli <= ONE} onClick={() => onQty(line.qty_milli - ONE)}>
          −
        </button>
        <span class="bill-line__count" data-testid="line-qty">
          {formatQty(line.qty_milli)} {unit}
        </span>
        <button type="button" class="btn" aria-label={t.moreOne} onClick={() => onQty(line.qty_milli + ONE)}>
          +
        </button>
      </div>

      <span data-testid="line-sum">
        {formatRupees(line.unit_price_paise)} × {formatQty(line.qty_milli)} = <strong>{formatRupees(draftLineTotal(line))}</strong>
      </span>

      {isPriceChanged(line) && (
        <div class="bill-line__changed" data-testid="price-changed">
          <span>
            <Icon name="warning" /> {t.priceChangedForBill} {formatRupees(line.default_price_paise)}
          </span>
          <button type="button" class="btn" onClick={() => void makeDefault()}>
            <Icon name="check" />
            {t.makeDefault}
          </button>
        </div>
      )}
      {defaultSaved && !isPriceChanged(line) && (
        <p class="done" role="status">
          <Icon name="check" />
          {t.defaultSaved}
        </p>
      )}
      {error && <Alert text={error} />}

      {editing ? (
        <form class="row-actions" onSubmit={save}>
          <label class="field">
            {editing.field === 'qty' ? `${t.typeQty} (${unit})` : t.linePrice}
            <input
              inputMode="decimal"
              maxLength={12}
              autoFocus
              value={editing.text}
              onInput={(e) => setEditing({ ...editing, text: e.currentTarget.value })}
            />
          </label>
          <button type="submit" class="btn btn--primary-inline">
            <Icon name="check" />
            {t.ok}
          </button>
          <button type="button" class="btn" onClick={() => setEditing(null)}>
            {t.cancel}
          </button>
        </form>
      ) : (
        <div class="row-actions">
          <button type="button" class="btn" onClick={() => setEditing({ field: 'qty', text: formatQty(line.qty_milli) })}>
            <Icon name="edit" />
            {t.typeQty}
          </button>
          <button type="button" class="btn" onClick={() => setEditing({ field: 'price', text: '' })}>
            <Icon name="edit" />
            {t.changeLinePrice}
          </button>
          <button type="button" class="btn" onClick={onRemove}>
            <Icon name="block" />
            {t.removeLine}
          </button>
        </div>
      )}
    </li>
  );
}
