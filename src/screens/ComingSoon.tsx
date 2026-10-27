import { EmptyState } from '../components/EmptyState';
import type { IconName } from '../components/Icon';
import { PillButton } from '../components/PillButton';
import { useI18n } from '../i18n';

/** Stands in for a menu screen that is not built yet. */
export function ComingSoon({ title, icon, onBack }: { title: string; icon: IconName; onBack: () => void }) {
  const { t } = useI18n();
  return (
    <section class="catalog">
      <h2>{title}</h2>
      <EmptyState icon={icon} text={t.comingSoon}>
        <PillButton primary icon="receipt" label={t.backToBill} onClick={onBack} />
      </EmptyState>
    </section>
  );
}
