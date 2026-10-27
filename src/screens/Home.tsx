import { useEffect, useState } from 'preact/hooks';
import { DeviceStatusBar } from '../components/DeviceStatusBar';
import { LangSwitch } from '../components/LangSwitch';
import { OwnerButton } from '../components/OwnerButton';
import { SavedNotice } from '../components/SavedNotice';
import { StaffArea } from '../components/StaffArea';
import { StorageWarnings } from '../components/StorageWarnings';
import type { BillRow } from '../db';
import { BillReceipt } from '../components/BillReceipt';
import { useI18n } from '../i18n';
import { useStaffSession } from '../staff/session';
import { Billing } from './Billing';
import { Catalog } from './Catalog';

export function Home({ onOwner }: { onOwner: () => void }) {
  const { t } = useI18n();
  const session = useStaffSession();
  const [managing, setManaging] = useState(false);
  const [saved, setSaved] = useState<BillRow | null>(null);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (session.active) {
      setSaved(null);
      setShowing(false);
    }
  }, [session.active]);

  const billSaved = (bill: BillRow) => {
    setSaved(bill);
    session.lock();
  };
  // Only the bill just saved, read only, so no PIN is needed to show it to the customer.
  if (!session.active && saved && showing) {
    return (
      <main class="screen">
        <BillReceipt billId={saved.id} onClose={() => setShowing(false)} />
      </main>
    );
  }

  return (
    <main class="screen">
      <header class="bar">
        <OwnerButton onClick={onOwner} />
        <LangSwitch />
      </header>
      <DeviceStatusBar />
      <StorageWarnings />
      {/* Hidden while working, so the item tiles start higher on small screens. */}
      {!session.active && <h1>{t.appReady}</h1>}
      {!session.active && saved && <SavedNotice bill={saved} onShow={() => setShowing(true)} />}
      <StaffArea />
      {session.active &&
        (managing ? <Catalog onClose={() => setManaging(false)} /> : <Billing onManage={() => setManaging(true)} onSaved={billSaved} />)}
    </main>
  );
}
