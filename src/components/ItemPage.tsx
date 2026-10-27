import { setArchived, setItemPicture } from '../db';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { itemName } from '../i18n/item-name';
import { formatRupees } from '../money';
import { useServices } from '../services';
import { Alert } from './Alert';
import { ChangePriceForm } from './ChangePriceForm';
import { ConfirmAction } from './ConfirmAction';
import { Icon } from './Icon';
import { ItemPicture } from './ItemPicture';
import { PhotoButton } from './PhotoButton';
import { PriceHistory } from './PriceHistory';

export function ItemPage({ itemId, onBack }: { itemId: string; onBack: () => void }) {
  const { t, lang } = useI18n();
  const { db } = useServices();
  // Live, so the price on screen changes the moment it is saved.
  const item = useLiveQuery(async () => (await db.items.get(itemId)) ?? null, [db, itemId]);
  const companyId = item.value?.company_id;
  const companyRemoved = useLiveQuery(async () => (companyId ? (await db.companies.get(companyId))?.archived === true : false), [db, companyId]);

  return (
    <section class="catalog item-page">
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={onBack}>
          <Icon name="back" />
          {t.back}
        </button>
      </header>
      {item.failed && <Alert text={t.loadFailed} />}
      {item.value && (
        <>
          <div class="item-page__head">
            <ItemPicture path={item.value.picture} name={itemName(item.value, lang)} />
            <h2>{itemName(item.value, lang)}</h2>
            {item.value.size && <span>{item.value.size}</span>}
            <span class="item-page__price" data-testid="current-price">
              {t.currentPrice} {formatRupees(item.value.price_paise)}
            </span>
            <PhotoButton
              label={item.value.picture ? t.changePhoto : t.takePhoto}
              onPhoto={async (photo) => {
                await setItemPicture(db, itemId, photo);
              }}
            />
          </div>
          <ChangePriceForm item={item.value} />
          <PriceHistory itemId={itemId} />
          <div class="danger-zone">
            {item.value.archived ? (
              <>
                <span class="tile__badge">{t.removedTag}</span>
                {companyRemoved.value ? (
                  <p class="hint">{t.companyRemovedHint}</p>
                ) : (
                  <button type="button" class="btn" onClick={() => setArchived(db, 'items', itemId, false)}>
                    <Icon name="undo" />
                    {t.restore}
                  </button>
                )}
              </>
            ) : (
              <ConfirmAction
                icon="archive"
                label={t.removeItem}
                question={t.confirmRemoveItem}
                onConfirm={() => setArchived(db, 'items', itemId, true)}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
