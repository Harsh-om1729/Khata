import { useState } from 'preact/hooks';
import { AddCompanyForm } from '../components/AddCompanyForm';
import { AddItemForm } from '../components/AddItemForm';
import { CompanyGrid } from '../components/CompanyGrid';
import { ItemGrid } from '../components/ItemGrid';
import type { CompanyRow } from '../db';

type View =
  | { name: 'companies' }
  | { name: 'addCompany' }
  | { name: 'company'; company: CompanyRow }
  | { name: 'addItem'; company: CompanyRow };

export function Catalog() {
  const [view, setView] = useState<View>({ name: 'companies' });
  const companies = () => setView({ name: 'companies' });
  const open = (company: CompanyRow) => setView({ name: 'company', company });

  switch (view.name) {
    case 'companies':
      return <CompanyGrid onOpen={open} onAdd={() => setView({ name: 'addCompany' })} />;
    case 'addCompany':
      // A new company opens straight away, so its first item is one tap further.
      return <AddCompanyForm onSaved={open} onCancel={companies} />;
    case 'company':
      return <ItemGrid company={view.company} onAdd={() => setView({ name: 'addItem', company: view.company })} onBack={companies} />;
    case 'addItem':
      return <AddItemForm company={view.company} onSaved={() => open(view.company)} onCancel={() => open(view.company)} />;
  }
}
