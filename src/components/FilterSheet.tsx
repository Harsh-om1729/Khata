import { useEffect } from 'preact/hooks';
import { defaultItemFilter, type CategoryCount, type CompanyRow, type ItemFilter, type ItemSort } from '../db';
import { useI18n } from '../i18n';
import { Icon } from './Icon';
import { PillButton } from './PillButton';

interface Props {
  filter: ItemFilter;
  onChange: (filter: ItemFilter) => void;
  onClose: () => void;
  companies: CompanyRow[];
  categories: CategoryCount[];
  /** The companies tab only uses "show removed". */
  itemsOnly: boolean;
}

const ALL = '*';

/** Changes apply at once, so the list behind updates while the sheet is open. */
export function FilterSheet({ filter, onChange, onClose, companies, categories, itemsOnly }: Props) {
  const { t } = useI18n();
  const sorts: [ItemSort, string][] = [['name', t.sortName], ['priceLow', t.sortPriceLow], ['priceHigh', t.sortPriceHigh]];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="drawer-layer">
      <button type="button" class="drawer-scrim" aria-label={t.close} tabIndex={-1} onClick={onClose} data-testid="sheet-scrim" />
      <div class="sheet" role="dialog" aria-modal="true" aria-label={t.filterTitle}>
        <h2 class="sheet__title">
          <Icon name="filter" />
          {t.filterTitle}
        </h2>
        {itemsOnly && (
          <>
            <label class="field">
              {t.tabCompanies}
              <select value={filter.companyId ?? ALL} onChange={(e) => onChange({ ...filter, companyId: e.currentTarget.value === ALL ? null : e.currentTarget.value })}>
                <option value={ALL}>{t.allCompanies}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label class="field">
              {t.tabCategories}
              <select value={filter.category ?? ALL} onChange={(e) => onChange({ ...filter, category: e.currentTarget.value === ALL ? null : e.currentTarget.value })}>
                <option value={ALL}>{t.allCategories}</option>
                {categories.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category || t.noCategory}
                  </option>
                ))}
              </select>
            </label>
            <fieldset class="units">
              <legend>{t.sortBy}</legend>
              {sorts.map(([sort, label]) => (
                <label key={sort} class="unit">
                  <input type="radio" name="sort" checked={filter.sort === sort} onChange={() => onChange({ ...filter, sort })} />
                  {label}
                </label>
              ))}
            </fieldset>
          </>
        )}
        <label class="check">
          <input type="checkbox" checked={filter.archived} onChange={(e) => onChange({ ...filter, archived: e.currentTarget.checked })} />
          {t.showArchived}
        </label>
        <div class="row-actions">
          <PillButton primary icon="check" label={t.ok} onClick={onClose} />
          <PillButton label={t.clearFilters} onClick={() => onChange(defaultItemFilter)} />
        </div>
      </div>
    </div>
  );
}
