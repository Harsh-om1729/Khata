import { useI18n } from '../i18n';
import { Icon } from './Icon';

export function SearchField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  return (
    <div class="search">
      <label class="search__box">
        <Icon name="search" />
        <span class="visually-hidden">{label}</span>
        <input type="search" placeholder={label} value={value} onInput={(e) => onChange(e.currentTarget.value)} />
      </label>
      {value && (
        <button type="button" class="btn" onClick={() => onChange('')}>
          {t.clearSearch}
        </button>
      )}
    </div>
  );
}
