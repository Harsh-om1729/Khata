import { useState } from 'preact/hooks';
import { AddCompanyForm } from '../components/AddCompanyForm';
import { AddItemForm } from '../components/AddItemForm';
import { Alert } from '../components/Alert';
import { CategoriesTab } from '../components/CategoriesTab';
import { CompaniesTab } from '../components/CompaniesTab';
import { ConfirmAction } from '../components/ConfirmAction';
import { ExcelImport } from '../components/ExcelImport';
import { FilterSheet } from '../components/FilterSheet';
import { Icon } from '../components/Icon';
import { ItemGrid } from '../components/ItemGrid';
import { ItemPage } from '../components/ItemPage';
import { ItemsTab } from '../components/ItemsTab';
import { PhotoButton } from '../components/PhotoButton';
import { PillButton } from '../components/PillButton';
import { SearchField } from '../components/SearchField';
import { Tabs, type TabSpec } from '../components/Tabs';
import { UnitsTab } from '../components/UnitsTab';
import {
  catalogRows,
  categoryCounts,
  defaultItemFilter,
  listCompanies,
  listItems,
  setArchived,
  setItemPicture,
  unitCounts,
  type CompanyRow,
  type ItemFilter,
} from '../db';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { itemName } from '../i18n/item-name';
import { useServices } from '../services';

type Tab = 'companies' | 'items' | 'categories' | 'units';

type View =
  | { name: 'tabs' }
  | { name: 'addCompany' }
  | { name: 'addItem' }
  | { name: 'excel' }
  | { name: 'company'; company: CompanyRow }
  | { name: 'addItemTo'; company: CompanyRow }
  | { name: 'item'; itemId: string; from: View };

/** Items and prices (UI-VOICE §2.7, §2.11). Tabs, filters and search survive a trip to an item and back. */
export function Catalog({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const { db } = useServices();
  const [view, setView] = useState<View>({ name: 'tabs' });
  const [tab, setTab] = useState<Tab>('companies');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ItemFilter>(defaultItemFilter);
  const [sheet, setSheet] = useState(false);
  const rows = useLiveQuery(() => catalogRows(db), [db]);

  const tabs = () => setView({ name: 'tabs' });
  const open = (company: CompanyRow) => setView({ name: 'company', company });
  const openItem = (itemId: string) => setView({ name: 'item', itemId, from: view });
  const switchTab = (next: Tab) => {
    setTab(next);
    setQuery('');
  };

  switch (view.name) {
    case 'excel':
      return <ExcelImport onBack={tabs} />;
    case 'addCompany':
      // A new company opens straight away, so its first item is one tap further.
      return <AddCompanyForm onSaved={open} onCancel={tabs} />;
    case 'addItem':
      return <AddItemForm company={null} onSaved={(item) => openItem(item.id)} onCancel={tabs} />;
    case 'addItemTo':
      return <AddItemForm company={view.company} onSaved={() => open(view.company)} onCancel={() => open(view.company)} />;
    case 'item':
      return <ItemPage itemId={view.itemId} onBack={() => setView(view.from.name === 'addItem' ? { name: 'tabs' } : view.from)} />;
    case 'company':
      return (
        <>
          <ItemGrid
            company={view.company}
            onAdd={() => setView({ name: 'addItemTo', company: view.company })}
            onPick={(item) => openItem(item.id)}
            onBack={tabs}
            extra={(item) => (
              <PhotoButton
                label={item.picture ? t.changePhoto : t.takePhoto}
                onPhoto={async (photo) => {
                  await setItemPicture(db, item.id, photo);
                }}
              />
            )}
          />
          <div class="danger-zone">
            <ConfirmAction
              icon="archive"
              label={t.removeCompany}
              question={t.confirmRemoveCompany}
              onConfirm={async () => {
                await setArchived(db, 'companies', view.company.id, true);
                tabs();
              }}
            />
          </div>
        </>
      );
    case 'tabs':
      break;
  }

  const tabSpecs: TabSpec<Tab>[] = [
    { key: 'companies', label: t.tabCompanies, icon: 'store' },
    { key: 'items', label: t.tabItems, icon: 'box' },
    { key: 'categories', label: t.tabCategories, icon: 'tag' },
    { key: 'units', label: t.tabUnits, icon: 'ruler' },
  ];
  const searchLabel = { companies: t.searchCompanies, items: t.search, categories: t.searchCategories, units: '' }[tab];
  const searching = query.trim() !== '';
  const all = rows.value;
  const activeCompanies = all ? listCompanies(all.companies, '', false) : [];
  const categories = all ? categoryCounts(all.companies, all.items) : [];
  const filtersOn = [filter.companyId !== null, filter.category !== null, filter.sort !== 'name', filter.archived].filter(Boolean).length;
  const restore = (table: 'companies' | 'items', id: string) => setArchived(db, table, id, false);

  const body = () => {
    if (!all) return null;
    switch (tab) {
      case 'companies':
        return (
          <CompaniesTab
            companies={listCompanies(all.companies, query, filter.archived)}
            searching={searching}
            archived={filter.archived}
            onOpen={open}
            onRestore={(company) => restore('companies', company.id)}
          />
        );
      case 'items':
        return (
          <ItemsTab
            listed={listItems(all.companies, all.items, query, filter, (item) => itemName(item, lang))}
            searching={searching}
            archived={filter.archived}
            onOpen={(item) => openItem(item.id)}
            onRestore={(item) => restore('items', item.id)}
          />
        );
      case 'categories': {
        const typed = query.trim().toLowerCase();
        const shown = typed ? categories.filter((c) => (c.category || t.noCategory).toLowerCase().includes(typed)) : categories;
        return (
          <CategoriesTab
            categories={shown}
            searching={searching}
            onPick={(category) => {
              setFilter({ ...filter, category });
              switchTab('items');
            }}
          />
        );
      }
      case 'units':
        return <UnitsTab counts={unitCounts(all.companies, all.items)} />;
    }
  };

  return (
    <section class="catalog catalog--tabs">
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={onClose}>
          <Icon name="back" />
          {t.back}
        </button>
      </header>
      <h2>{t.manageItems}</h2>
      <Tabs tabs={tabSpecs} value={tab} onChange={switchTab} />
      {tab !== 'units' && (
        <div class="catalog__tools">
          <SearchField label={searchLabel} value={query} onChange={setQuery} />
          {(tab === 'companies' || tab === 'items') && (
            <button type="button" class={filtersOn ? 'btn btn--primary-inline' : 'btn'} onClick={() => setSheet(true)}>
              <Icon name="filter" />
              {filtersOn ? `${t.filter} (${filtersOn})` : t.filter}
            </button>
          )}
        </div>
      )}
      {rows.failed && <Alert text={t.loadFailed} />}
      {body()}
      {tab === 'companies' && (
        <button type="button" class="btn" onClick={() => setView({ name: 'excel' })}>
          <Icon name="upload" />
          {t.excelTitle}
        </button>
      )}
      {(tab === 'companies' || tab === 'items') && (
        <div class="fab">
          <PillButton
            primary
            icon="plus"
            label={tab === 'companies' ? t.addCompany : t.addItem}
            onClick={() => setView(tab === 'companies' ? { name: 'addCompany' } : { name: 'addItem' })}
          />
        </div>
      )}
      {sheet && (
        <FilterSheet
          filter={filter}
          onChange={setFilter}
          onClose={() => setSheet(false)}
          companies={activeCompanies}
          categories={categories}
          itemsOnly={tab === 'items'}
        />
      )}
    </section>
  );
}
