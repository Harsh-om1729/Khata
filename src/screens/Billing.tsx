import { useState } from 'preact/hooks';
import { AddCompanyForm } from '../components/AddCompanyForm';
import { AddItemForm } from '../components/AddItemForm';
import { BillStrip } from '../components/BillStrip';
import { CompanyGrid } from '../components/CompanyGrid';
import { Icon } from '../components/Icon';
import { ItemGrid } from '../components/ItemGrid';
import { ItemSearch } from '../components/ItemSearch';
import { addItem, emptyBill, formatQty, type DraftBill } from '../bill';
import type { CompanyRow, ItemRow } from '../db';
import { useI18n } from '../i18n';

type View =
  | { name: 'companies' }
  | { name: 'addCompany' }
  | { name: 'company'; company: CompanyRow }
  | { name: 'addItem'; company: CompanyRow };

/** The main screen after unlock. The bill lives in memory only, so locking or closing the app never hands it to the next person. */
export function Billing({ onManage }: { onManage: () => void }) {
  const { t } = useI18n();
  const [view, setView] = useState<View>({ name: 'companies' });
  const [bill, setBill] = useState<DraftBill>(emptyBill);
  const [history, setHistory] = useState<DraftBill[]>([]);
  const [query, setQuery] = useState('');

  const companies = () => setView({ name: 'companies' });
  const open = (company: CompanyRow) => setView({ name: 'company', company });

  const pick = (item: ItemRow) => {
    setHistory((h) => [...h, bill]);
    setBill(addItem(bill, item));
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setBill(previous);
  };
  const badge = (item: ItemRow) => {
    const line = bill.lines.find((l) => l.item_id === item.id);
    return line ? `${t.onBill} ${formatQty(line.qty_milli)}` : null;
  };

  const body = () => {
    if (query.trim()) return <ItemSearch query={query} onPick={pick} badge={badge} />;
    switch (view.name) {
      case 'companies':
        return <CompanyGrid onOpen={open} onAdd={() => setView({ name: 'addCompany' })} />;
      case 'addCompany':
        return <AddCompanyForm onSaved={open} onCancel={companies} />;
      case 'company':
        return (
          <ItemGrid company={view.company} onAdd={() => setView({ name: 'addItem', company: view.company })} onPick={pick} onBack={companies} badge={badge} />
        );
      case 'addItem':
        return <AddItemForm company={view.company} onSaved={() => open(view.company)} onCancel={() => open(view.company)} />;
    }
  };

  return (
    <div class="billing">
      <div class="search">
        <label class="search__box">
          <Icon name="search" />
          <span class="visually-hidden">{t.search}</span>
          <input type="search" placeholder={t.search} value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
        </label>
        {query && (
          <button type="button" class="btn" onClick={() => setQuery('')}>
            {t.clearSearch}
          </button>
        )}
      </div>
      {body()}
      <button type="button" class="btn manage-link" onClick={onManage}>
        <Icon name="edit" />
        {t.manageItems}
      </button>
      <BillStrip bill={bill} canUndo={history.length > 0} onUndo={undo} />
    </div>
  );
}
