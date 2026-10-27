import type { CompanyRow } from '../db';
import { useI18n } from '../i18n';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';

interface Props {
  companies: CompanyRow[];
  searching: boolean;
  archived: boolean;
  onOpen: (company: CompanyRow) => void;
  onRestore: (company: CompanyRow) => void;
}

export function CompaniesTab({ companies, searching, archived, onOpen, onRestore }: Props) {
  const { t } = useI18n();
  if (companies.length === 0) {
    return <EmptyState icon="store" text={searching ? t.searchNone : archived ? t.removedNone : t.companiesEmpty} />;
  }
  return (
    <div class="tiles">
      {companies.map((company) =>
        company.archived ? (
          <div key={company.id} class="tile tile--removed">
            <span class="tile__avatar" aria-hidden="true">
              {company.name.charAt(0)}
            </span>
            <span class="tile__name">{company.name}</span>
            <span class="tile__badge">{t.removedTag}</span>
            <button type="button" class="btn" onClick={() => onRestore(company)}>
              <Icon name="undo" />
              {t.restore}
            </button>
          </div>
        ) : (
          <button key={company.id} type="button" class="tile" onClick={() => onOpen(company)}>
            <span class="tile__avatar" aria-hidden="true">
              {company.name.charAt(0)}
            </span>
            <span class="tile__name">{company.name}</span>
          </button>
        ),
      )}
    </div>
  );
}
