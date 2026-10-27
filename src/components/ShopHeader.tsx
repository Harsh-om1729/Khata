import { shopProfile } from '../db';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { formatPhone } from '../i18n/phone';
import { stateName } from '../i18n/state-name';
import { isStateCode } from '../profile';
import { useServices } from '../services';

/** The shop's name and details at the top of a bill (SPEC §2.1). Nothing until the shop name is saved. */
export function ShopHeader() {
  const { t, lang } = useI18n();
  const { db } = useServices();
  const profile = useLiveQuery(() => shopProfile(db), [db]).value;
  if (!profile?.shop_name) return null;

  const state = isStateCode(profile.state) ? stateName(profile.state, lang) : '';
  const place = [profile.address, [state, profile.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const phones = [profile.phone1, profile.phone2].filter(Boolean).map(formatPhone).join(', ');
  return (
    <header class="shop-header" data-testid="shop-header">
      <strong class="shop-header__name">{profile.shop_name}</strong>
      {place && <span>{place}</span>}
      {phones && (
        <span>
          {t.phoneShort}: {phones}
        </span>
      )}
      {profile.gstin && <span class="nowrap">GSTIN: {profile.gstin}</span>}
    </header>
  );
}
