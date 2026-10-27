import { useState } from 'preact/hooks';
import { AddCompanyForm } from '../components/AddCompanyForm';
import { AddItemForm } from '../components/AddItemForm';
import { BillReview } from '../components/BillReview';
import { BillStrip } from '../components/BillStrip';
import { CompanyGrid } from '../components/CompanyGrid';
import { Icon } from '../components/Icon';
import { ItemGrid } from '../components/ItemGrid';
import { ItemSearch } from '../components/ItemSearch';
import { addItem, emptyBill, formatQty, removeLine, setLineDefault, setLinePrice, setQty, type DraftBill } from '../bill';
import { changePrice, type CompanyRow, type ItemRow } from '../db';
import { useI18n } from '../i18n';
import { useServices } from '../services';
import { useAuthor } from '../staff/use-author';

type View =
  | { name: 'companies' }
  | { name: 'addCompany' }
  | { name: 'company'; company: CompanyRow }
  | { name: 'addItem'; company: CompanyRow }
  | { name: 'review'; from: View };

/** The main screen after unlock. The bill lives in memory only, so locking or closing the app never hands it to the next person. */
export function Billing({ onManage }: { onManage: () => void }) {
  const { t } = useI18n();
  const { db } = useServices();
  const author = useAuthor();
  const [view, setView] = useState<View>({ name: 'companies' });
  const [bill, setBill] = useState<DraftBill>(emptyBill);
  const [history, setHistory] = useState<DraftBill[]>([]);
  const [query, setQuery] = useState('');

  const companies = () => setView({ name: 'companies' });
  const open = (company: CompanyRow) => setView({ name: 'company', company });

  /** Every change to the bill can be taken back with undo. */
  const change = (next: DraftBill) => {
    setHistory((h) => [...h, bill]);
    setBill(next);
  };
  const pick = (item: ItemRow) => change(addItem(bill, item));
  const review = () => {
    setQuery('');
    if (view.name !== 'review') setView({ name: 'review', from: view });
  };
  // Not an edit of the bill, so undo does not reverse it; the price log keeps the record.
  const makeDefault = async (lineId: string) => {
    const line = bill.lines.find((l) => l.id === lineId);
    if (!line) return;
    await changePrice(db, author, line.item_id, line.unit_price_paise);
    setBill((current) => setLineDefault(current, lineId, line.unit_price_paise));
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
      case 'review':
        return (
          <BillReview
            bill={bill}
            onBack={() => setView(view.from)}
            onQty={(id, qty) => change(setQty(bill, id, qty))}
            onPrice={(id, price) => change(setLinePrice(bill, id, price))}
            onRemove={(id) => change(removeLine(bill, id))}
            onMakeDefault={makeDefault}
          />
        );
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
      <BillStrip bill={bill} canUndo={history.length > 0} onUndo={undo} onReview={view.name === 'review' ? undefined : review} />
    </div>
  );
}
