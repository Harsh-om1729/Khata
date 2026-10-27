import { useI18n } from '../i18n';
import { Icon } from './Icon';

export function MenuButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" class="btn" onClick={onClick}>
      <Icon name="menu" />
      {t.menu}
    </button>
  );
}
