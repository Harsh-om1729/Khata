import type { Listed } from '../db';
import { useI18n } from '../i18n';
import { itemName } from '../i18n/item-name';
import { unitLabel } from '../i18n/unit-label';
import { formatRupees } from '../money';
import { Icon } from './Icon';
import { ItemPicture } from './ItemPicture';

interface Props {
  listed: Listed;
  onOpen: () => void;
  /** Only in the removed list: brings back an item whose company is still on sale. */
  onRestore?: () => void;
}

export function ItemListRow({ listed: { item, company }, onOpen, onRestore }: Props) {
  const { t, lang } = useI18n();
  const name = itemName(item, lang);
  const companyRemoved = company?.archived === true;
  const details = [item.size, company?.name, unitLabel(t, item.unit)].filter(Boolean).join(' · ');
  return (
    <li class="item-row" data-testid="item-row">
      <button type="button" class="item-row__open" onClick={onOpen}>
        <span class="item-row__pic">
          <ItemPicture path={item.picture} name={name} />
        </span>
        <span class="item-row__text">
          <strong>{name}</strong>
          <span class="item-row__details">{details}</span>
          {item.needs_review && <span class="tile__badge">{t.needsReview}</span>}
          {(item.archived || companyRemoved) && <span class="tile__badge">{t.removedTag}</span>}
        </span>
        <strong class="item-row__price">{formatRupees(item.price_paise)}</strong>
      </button>
      {onRestore && item.archived && !companyRemoved && (
        <button type="button" class="btn" onClick={onRestore}>
          <Icon name="undo" />
          {t.restore}
        </button>
      )}
      {onRestore && companyRemoved && <p class="hint">{t.companyRemovedHint}</p>}
    </li>
  );
}
