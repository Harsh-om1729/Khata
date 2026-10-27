import { activeCompanies, type CompanyRow } from '../db';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { useServices } from '../services';
import { Alert } from './Alert';
import { Icon } from './Icon';

interface Props {
  onOpen: (company: CompanyRow) => void;
  onAdd: () => void;
}

export function CompanyGrid({ onOpen, onAdd }: Props) {
  const { t } = useI18n();
  const { db } = useServices();
  const companies = useLiveQuery(() => activeCompanies(db), [db]);

  return (
    <section class="catalog">
      <h2>{t.companies}</h2>
      {companies.failed && <Alert text={t.loadFailed} />}
      <div class="tiles">
        <button type="button" class="tile tile--add" onClick={onAdd}>
          <span class="tile__avatar" aria-hidden="true">
            <Icon name="plus" />
          </span>
          <span class="tile__name">{t.addCompany}</span>
        </button>
        {companies.value?.map((company) => (
          <button key={company.id} type="button" class="tile" onClick={() => onOpen(company)}>
            <span class="tile__avatar" aria-hidden="true">
              {company.name.charAt(0)}
            </span>
            <span class="tile__name">{company.name}</span>
          </button>
        ))}
      </div>
      {companies.value?.length === 0 && <p class="hint">{t.companiesEmpty}</p>}
    </section>
  );
}
