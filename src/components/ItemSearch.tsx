import type { ItemRow } from '../db';
import { searchItems, type Found } from '../db/search';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { itemName } from '../i18n/item-name';
import { useServices } from '../services';
import { ItemTile } from './ItemTile';

interface Props {
  query: string;
  onPick: (item: ItemRow) => void;
  badge: (item: ItemRow) => string | null;
}

export function ItemSearch({ query, onPick, badge }: Props) {
  const { t, lang } = useI18n();
  const { db } = useServices();
  const all = useLiveQuery(async () => ({ companies: await db.companies.toArray(), items: await db.items.toArray() }), [db]);
  const found: Found[] = all.value ? searchItems(all.value.companies, all.value.items, query) : [];
  found.sort((a, b) => itemName(a.item, lang).localeCompare(itemName(b.item, lang)));

  return (
    <section class="catalog" aria-live="polite">
      {all.value && found.length === 0 && <p class="hint">{t.searchNone}</p>}
      <div class="tiles">
        {found.map(({ item, company }) => (
          <ItemTile key={item.id} item={item} company={company.name} onPick={onPick} badge={badge(item)} />
        ))}
      </div>
    </section>
  );
}
