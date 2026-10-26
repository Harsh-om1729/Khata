import { useI18n } from '../i18n';
import { Icon } from './Icon';

export function OwnerButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" class="btn" onClick={onClick}>
      <Icon name="person" />
      {t.owner}
    </button>
  );
}
