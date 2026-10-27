import { useEffect, useState } from 'preact/hooks';
import { DeviceStatusBar } from '../components/DeviceStatusBar';
import { ExcelImport } from '../components/ExcelImport';
import type { IconName } from '../components/Icon';
import { LangSwitch } from '../components/LangSwitch';
import { MenuButton } from '../components/MenuButton';
import { OwnerButton } from '../components/OwnerButton';
import { SavedNotice } from '../components/SavedNotice';
import { SideMenu } from '../components/SideMenu';
import { StaffArea } from '../components/StaffArea';
import { StorageWarnings } from '../components/StorageWarnings';
import type { BillRow } from '../db';
import { BillReceipt } from '../components/BillReceipt';
import { useI18n } from '../i18n';
import type { Messages } from '../i18n/types';
import { useStaffSession } from '../staff/session';
import { Billing } from './Billing';
import { Catalog } from './Catalog';
import { ComingSoon } from './ComingSoon';
import { OldBills } from './OldBills';
import { ShopProfile } from './ShopProfile';
import type { Route } from './routes';

const soon: Partial<Record<Route, { title: keyof Messages; icon: IconName }>> = {
  udhaar: { title: 'menuUdhaar', icon: 'book' },
  dashboard: { title: 'dashboard', icon: 'chart' },
  sync: { title: 'cloudBackup', icon: 'cloud' },
};

export function Home({ onOwner }: { onOwner: () => void }) {
  const { t } = useI18n();
  const session = useStaffSession();
  const [route, setRoute] = useState<Route>('bill');
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState<BillRow | null>(null);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (session.active) {
      setSaved(null);
      setShowing(false);
    } else {
      // Whoever unlocks next always starts on billing, never on someone else's screen.
      setRoute('bill');
      setMenuOpen(false);
    }
  }, [session.active]);

  const billSaved = (bill: BillRow) => {
    setSaved(bill);
    session.lock();
  };
  const bill = () => setRoute('bill');
  const other = (to: Route) => {
    switch (to) {
      case 'items':
        return <Catalog onClose={bill} />;
      case 'excel':
        return <ExcelImport onBack={bill} />;
      case 'history':
        return <OldBills onBack={bill} />;
      case 'profile':
        return <ShopProfile onBack={bill} />;
      default: {
        const page = soon[to];
        return page && <ComingSoon title={t[page.title]} icon={page.icon} onBack={bill} />;
      }
    }
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
      {/* Out of reach for screen readers and taps while the menu covers it. */}
      <div inert={menuOpen}>
        <header class="bar">
          {session.active ? <MenuButton onClick={() => setMenuOpen(true)} /> : <OwnerButton onClick={onOwner} />}
          <LangSwitch />
        </header>
        <DeviceStatusBar />
        <StorageWarnings />
        {/* Hidden while working, so the item tiles start higher on small screens. */}
        {!session.active && <h1>{t.appReady}</h1>}
        {!session.active && saved && <SavedNotice bill={saved} onShow={() => setShowing(true)} />}
        <StaffArea />
        {session.active && (
          <>
            {/* Kept mounted while another screen shows, so a bill in progress survives a trip through the menu. */}
            <div hidden={route !== 'bill'}>
              <Billing onManage={() => setRoute('items')} onSaved={billSaved} />
            </div>
            {route !== 'bill' && other(route)}
          </>
        )}
      </div>
      {session.active && menuOpen && <SideMenu current={route} onGo={setRoute} onOwner={onOwner} onClose={() => setMenuOpen(false)} />}
    </main>
  );
}
