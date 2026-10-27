import { activeItems, setItemPicture, type CompanyRow, type ItemRow } from '../db';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { itemName } from '../i18n/item-name';
import { formatRupees } from '../money';
import { useServices } from '../services';
import { Alert } from './Alert';
import { Icon } from './Icon';
import { ItemPicture } from './ItemPicture';
import { PhotoButton } from './PhotoButton';

interface Props {
  company: CompanyRow;
  onAdd: () => void;
  onOpen: (item: ItemRow) => void;
  onBack: () => void;
}

export function ItemGrid({ company, onAdd, onOpen, onBack }: Props) {
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
          <div key={item.id} class="tile" data-testid="item-tile">
            <button type="button" class="tile__open" onClick={() => onOpen(item)}>
              <ItemPicture path={item.picture} name={itemName(item, lang)} />
              <span class="tile__name">{itemName(item, lang)}</span>
              {item.size && <span>{item.size}</span>}
              <span class="tile__price">{formatRupees(item.price_paise)}</span>
              {item.needs_review && <span class="tile__badge">{t.needsReview}</span>}
            </button>
            <PhotoButton
              label={item.picture ? t.changePhoto : t.takePhoto}
              onPhoto={async (photo) => {
                await setItemPicture(db, item.id, photo);
              }}
            />
          </div>
        ))}
      </div>
      {sorted?.length === 0 && <p class="hint">{t.itemsEmpty}</p>}
    </section>
  );
}
