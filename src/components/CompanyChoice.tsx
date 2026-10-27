import { activeCompanies } from '../db';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { useServices } from '../services';

export const NEW_COMPANY = '__new__';

interface Props {
  /** A company id, NEW_COMPANY, or '' when nothing is chosen yet. */
  value: string;
  newName: string;
  onChange: (value: string) => void;
  onNewName: (name: string) => void;
}

/** Pick an existing company, or type a new one. */
export function CompanyChoice({ value, newName, onChange, onNewName }: Props) {
  const { t } = useI18n();
  const { db } = useServices();
  const companies = useLiveQuery(() => activeCompanies(db), [db]);
  return (
    <>
      <label class="field">
        {t.companyName}
        <select class="select" value={value} onChange={(e) => onChange(e.currentTarget.value)}>
          <option value="">{t.chooseCompany}</option>
          {companies.value?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_COMPANY}>+ {t.newCompany}</option>
        </select>
      </label>
      {value === NEW_COMPANY && (
        <label class="field">
          {t.newCompanyName}
          <input maxLength={80} value={newName} onInput={(e) => onNewName(e.currentTarget.value)} />
        </label>
      )}
    </>
  );
}
