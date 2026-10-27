import { useEffect, useState } from 'preact/hooks';
import { DeviceStatusBar } from '../components/DeviceStatusBar';
import { LangSwitch } from '../components/LangSwitch';
import { OwnerButton } from '../components/OwnerButton';
import { SavedNotice } from '../components/SavedNotice';
import { StaffArea } from '../components/StaffArea';
import type { BillRow } from '../db';
import { useI18n } from '../i18n';
import { useStaffSession } from '../staff/session';
import { Billing } from './Billing';
import { Catalog } from './Catalog';

export function Home({ onOwner }: { onOwner: () => void }) {
  const { t } = useI18n();
  const session = useStaffSession();
  const [managing, setManaging] = useState(false);
  const [saved, setSaved] = useState<BillRow | null>(null);

  useEffect(() => {
    if (session.active) setSaved(null);
  }, [session.active]);

  const billSaved = (bill: BillRow) => {
    setSaved(bill);
    session.lock();
  };
  return (
    <main class="screen">
      <header class="bar">
        <OwnerButton onClick={onOwner} />
        <LangSwitch />
      </header>
      <DeviceStatusBar />
      {/* Hidden while working, so the item tiles start higher on small screens. */}
      {!session.active && <h1>{t.appReady}</h1>}
      {!session.active && saved && <SavedNotice bill={saved} />}
      <StaffArea />
      {session.active &&
        (managing ? <Catalog onClose={() => setManaging(false)} /> : <Billing onManage={() => setManaging(true)} onSaved={billSaved} />)}
    </main>
  );
}
