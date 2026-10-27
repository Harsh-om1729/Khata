import { useState } from 'preact/hooks';
import { AddCompanyForm } from '../components/AddCompanyForm';
import { AddItemForm } from '../components/AddItemForm';
import { CompanyGrid } from '../components/CompanyGrid';
import { ExcelImport } from '../components/ExcelImport';
import { ItemGrid } from '../components/ItemGrid';
import { ItemPage } from '../components/ItemPage';
import { PhotoButton } from '../components/PhotoButton';
import { setItemPicture, type CompanyRow } from '../db';
import { useI18n } from '../i18n';
import { useServices } from '../services';

type View =
  | { name: 'companies' }
  | { name: 'addCompany' }
  | { name: 'excel' }
  | { name: 'company'; company: CompanyRow }
  | { name: 'addItem'; company: CompanyRow }
  | { name: 'item'; company: CompanyRow; itemId: string };

/** Items and prices (UI-VOICE §2.7): photos, price changes and Excel. Tapping an item opens its page. */
export function Catalog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { db } = useServices();
  const [view, setView] = useState<View>({ name: 'companies' });
  const companies = () => setView({ name: 'companies' });
  const open = (company: CompanyRow) => setView({ name: 'company', company });

  switch (view.name) {
    case 'companies':
      return (
        <CompanyGrid
          title={t.manageItems}
          onBack={onClose}
          onOpen={open}
          onAdd={() => setView({ name: 'addCompany' })}
          onExcel={() => setView({ name: 'excel' })}
        />
      );
    case 'excel':
      return <ExcelImport onBack={companies} />;
    case 'addCompany':
      // A new company opens straight away, so its first item is one tap further.
      return <AddCompanyForm onSaved={open} onCancel={companies} />;
    case 'company':
      return (
        <ItemGrid
          company={view.company}
          onAdd={() => setView({ name: 'addItem', company: view.company })}
          onPick={(item) => setView({ name: 'item', company: view.company, itemId: item.id })}
          onBack={companies}
          extra={(item) => (
            <PhotoButton
              label={item.picture ? t.changePhoto : t.takePhoto}
              onPhoto={async (photo) => {
                await setItemPicture(db, item.id, photo);
              }}
            />
          )}
        />
      );
    case 'addItem':
      return <AddItemForm company={view.company} onSaved={() => open(view.company)} onCancel={() => open(view.company)} />;
    case 'item':
      return <ItemPage itemId={view.itemId} onBack={() => open(view.company)} />;
  }
}
