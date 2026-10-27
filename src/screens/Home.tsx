import { DeviceStatusBar } from '../components/DeviceStatusBar';
import { LangSwitch } from '../components/LangSwitch';
import { OwnerButton } from '../components/OwnerButton';
import { StaffArea } from '../components/StaffArea';
import { useI18n } from '../i18n';
import { useStaffSession } from '../staff/session';
import { Catalog } from './Catalog';

export function Home({ onOwner }: { onOwner: () => void }) {
  const { t } = useI18n();
  const session = useStaffSession();
  return (
    <main class="screen">
      <header class="bar">
        <OwnerButton onClick={onOwner} />
        <LangSwitch />
      </header>
      <DeviceStatusBar />
      <h1>{t.appReady}</h1>
      <StaffArea />
      {session.active && <Catalog />}
    </main>
  );
}
