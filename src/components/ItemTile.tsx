import type { ComponentChildren } from 'preact';
import type { ItemRow } from '../db';
import { useI18n } from '../i18n';
import { itemName } from '../i18n/item-name';
import { formatRupees } from '../money';
import { ItemPicture } from './ItemPicture';

interface Props {
  item: ItemRow;
  onPick: (item: ItemRow) => void;
  /** Shown when items from several companies are listed together, e.g. search results. */
  company?: string;
  /** e.g. "On bill: 2"; text, so it never relies on colour. */
  badge?: string | null;
  children?: ComponentChildren;
}

export function ItemTile({ item, onPick, company, badge, children }: Props) {
  const { t, lang } = useI18n();
  const name = itemName(item, lang);
  return (
    <div class={badge ? 'tile tile--picked' : 'tile'} data-testid="item-tile">
      <button type="button" class="tile__open" onClick={() => onPick(item)}>
        <ItemPicture path={item.picture} name={name} />
        <span class="tile__name">{name}</span>
        {item.size && <span>{item.size}</span>}
        {company && <span class="tile__company">{company}</span>}
        <span class="tile__price">{formatRupees(item.price_paise)}</span>
        {item.needs_review && <span class="tile__badge">{t.needsReview}</span>}
        {badge && <span class="tile__count">{badge}</span>}
      </button>
      {children}
    </div>
  );
}
