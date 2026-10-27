import type { ComponentChildren } from 'preact';
import { activeItems, type CompanyRow, type ItemRow } from '../db';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { itemName } from '../i18n/item-name';
import { useServices } from '../services';
import { Alert } from './Alert';
import { Icon } from './Icon';
import { ItemTile } from './ItemTile';

interface Props {
  company: CompanyRow;
  onAdd: () => void;
  /** Adds to the bill while billing; opens the item page when managing items. */
  onPick: (item: ItemRow) => void;
  onBack: () => void;
  badge?: (item: ItemRow) => string | null;
  extra?: (item: ItemRow) => ComponentChildren;
}

export function ItemGrid({ company, onAdd, onPick, onBack, badge, extra }: Props) {
  const { t, lang } = useI18n();
  const { db } = useServices();
  const items = useLiveQuery(() => activeItems(db, company.id), [db, company.id]);
  const sorted = items.value?.slice().sort((a, b) => itemName(a, lang).localeCompare(itemName(b, lang)));

  return (
    <section class="catalog">
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={onBack}>
          <Icon name="back" />
          {t.back}
        </button>
      </header>
      <h2>{company.name}</h2>
      {items.failed && <Alert text={t.loadFailed} />}
      <div class="tiles">
        <button type="button" class="tile tile--add" onClick={onAdd}>
          <span class="tile__avatar" aria-hidden="true">
            <Icon name="plus" />
          </span>
          <span class="tile__name">{t.addItem}</span>
        </button>
        {sorted?.map((item) => (
          <ItemTile key={item.id} item={item} onPick={onPick} badge={badge?.(item)}>
            {extra?.(item)}
          </ItemTile>
        ))}
      </div>
      {sorted?.length === 0 && <p class="hint">{t.itemsEmpty}</p>}
    </section>
  );
}
