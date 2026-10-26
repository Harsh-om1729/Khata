import { DeviceStatusBar } from '../components/DeviceStatusBar';
import { LangSwitch } from '../components/LangSwitch';
import { OwnerButton } from '../components/OwnerButton';
import { useI18n } from '../i18n';

export function Home({ onOwner }: { onOwner: () => void }) {
  const { t } = useI18n();
  return (
    <main class="screen">
      <header class="bar">
        <OwnerButton onClick={onOwner} />
        <LangSwitch />
      </header>
      <DeviceStatusBar />
      <h1>{t.appReady}</h1>
    </main>
  );
}
