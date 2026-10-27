import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { KhataDb, createCompany, createItem, saveShopProfile } from '../../src/db';
import { emptyProfile } from '../../src/profile';
import { hi } from '../../src/i18n';
import type { StaffMember } from '../../src/staff/types';
import { APPROVED_ID, fakeDevice, fakeDeviceAdmin } from './fakes';

const ramesh: StaffMember = { id: 'staff-ramesh', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };
const author = { staff: ramesh, deviceId: APPROVED_ID };
let db: KhataDb;

beforeEach(async () => {
  localStorage.clear();
  db = new KhataDb(`test-${crypto.randomUUID()}`);
  const ultratech = await createCompany(db, author, { name: 'Ultratech' });
  await createItem(db, author, { company_id: ultratech.id, name_en: 'Cement', size: '50kg', unit: 'bag', price_paise: 38_000 });
});
afterEach(async () => {
  cleanup();
  await db.delete();
});

async function unlock() {
  render(
    <App
      services={{
        db,
        device: { ...fakeDevice({ id: APPROVED_ID, status: 'approved', code: 'A' }), cached: () => ({ id: APPROVED_ID, status: 'approved' as const, code: 'A' }) },
        deviceAdmin: fakeDeviceAdmin(),
        staffDirectory: { cached: () => [ramesh], refresh: async () => [ramesh] },
        staffLogin: { login: vi.fn(async () => ({ kind: 'ok' as const })), lockedUntil: () => null },
      }}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Ramesh/ }));
  for (const digit of '2468') fireEvent.click(screen.getByRole('button', { name: digit }));
  await screen.findByText(hi.companies);
}

const openMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: hi.menu }));
  return screen.getByRole('dialog', { name: hi.menu });
};
const row = (menu: HTMLElement, name: string) => within(menu).getByRole('button', { name });

describe('side menu (U-2)', () => {
  it('is only there once someone is unlocked; the lock screen keeps the owner button', async () => {
    render(
      <App
        services={{
          db,
          device: fakeDevice({ id: APPROVED_ID, status: 'approved', code: 'A' }),
          deviceAdmin: fakeDeviceAdmin(),
          staffDirectory: { cached: () => [ramesh], refresh: async () => [ramesh] },
        }}
      />,
    );
    await screen.findByRole('button', { name: /Ramesh/ });
    expect(screen.queryByRole('button', { name: hi.menu })).toBeNull();
    expect(screen.getByRole('button', { name: hi.owner })).toBeTruthy();
  });

  it('shows the shop name and who is working', async () => {
    await saveShopProfile(db, author, { ...emptyProfile(), shop_name: 'Anand Hardware' });
    await unlock();
    const menu = openMenu();
    expect(await within(menu).findByText('Anand Hardware')).toBeTruthy();
    expect(within(menu).getByText(/Ramesh/)).toBeTruthy();
  });

  it('shows the app name before the shop name is saved', async () => {
    await unlock();
    expect(within(openMenu()).getByText(hi.appName)).toBeTruthy();
  });

  it('every row opens its screen and closes the menu', async () => {
    const cases: [parent: string | null, name: string, check: () => Promise<unknown>][] = [
      [hi.bill, hi.billHistory, () => screen.findByText(hi.billHistoryEmpty)],
      [hi.menuItems, hi.manageItems, () => screen.findByRole('heading', { name: hi.manageItems })],
      [hi.menuItems, hi.excelTitle, () => screen.findByRole('button', { name: hi.downloadTemplate })],
      [null, hi.menuUdhaar, () => screen.findByRole('heading', { name: hi.menuUdhaar })],
      [null, hi.dashboard, () => screen.findByRole('heading', { name: hi.dashboard })],
      [null, hi.shopProfile, () => screen.findByRole('heading', { name: hi.shopProfile })],
      [null, hi.cloudBackup, () => screen.findByRole('heading', { name: hi.cloudBackup })],
      [hi.bill, hi.newBill, async () => expect(screen.getByTestId('bill-total').closest('[hidden]')).toBeNull()],
    ];
    await unlock();
    for (const [parent, name, check] of cases) {
      const menu = openMenu();
      if (parent && !within(menu).queryByRole('button', { name })) fireEvent.click(row(menu, parent));
      fireEvent.click(row(menu, name));
      expect(screen.queryByRole('dialog')).toBeNull();
      await check();
    }
  });

  it('screens not built yet say so and lead back to the bill', async () => {
    await unlock();
    fireEvent.click(row(openMenu(), hi.dashboard));
    expect(await screen.findByText(hi.comingSoon)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: hi.backToBill }));
    expect(screen.getByTestId('bill-total').closest('[hidden]')).toBeNull();
  });

  it('opens one section at a time, and marks the screen showing now', async () => {
    await unlock();
    const menu = openMenu();
    expect(row(menu, hi.bill).getAttribute('aria-expanded')).toBe('true');
    expect(row(menu, hi.newBill).getAttribute('aria-current')).toBe('page');
    fireEvent.click(row(menu, hi.menuItems));
    expect(row(menu, hi.menuItems).getAttribute('aria-expanded')).toBe('true');
    expect(row(menu, hi.bill).getAttribute('aria-expanded')).toBe('false');
    expect(within(menu).queryByRole('button', { name: hi.newBill })).toBeNull();
    fireEvent.click(row(menu, hi.menuItems));
    expect(within(menu).queryByRole('button', { name: hi.manageItems })).toBeNull();
  });

  it('closes on the dimmed background, the close button, Escape and a left swipe', async () => {
    await unlock();
    const closers: (() => void)[] = [
      () => fireEvent.click(screen.getByTestId('drawer-scrim')),
      () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: hi.closeMenu })),
      () => fireEvent.keyDown(document, { key: 'Escape' }),
      () => {
        const menu = screen.getByRole('dialog');
        fireEvent.touchStart(menu, { touches: [{ clientX: 250 }] });
        fireEvent.touchEnd(menu, { changedTouches: [{ clientX: 100 }] });
      },
    ];
    for (const close of closers) {
      openMenu();
      close();
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });

  it('a small sideways touch does not close it', async () => {
    await unlock();
    const menu = openMenu();
    fireEvent.touchStart(menu, { touches: [{ clientX: 250 }] });
    fireEvent.touchEnd(menu, { changedTouches: [{ clientX: 220 }] });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('a bill in progress survives a trip through the menu', async () => {
    await unlock();
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    const tiles = await screen.findAllByTestId('item-tile');
    fireEvent.click(within(tiles[0] as HTMLElement).getAllByRole('button')[0] as HTMLElement);
    expect(screen.getByTestId('bill-total').textContent).toBe('₹380');

    fireEvent.click(row(openMenu(), hi.dashboard));
    await screen.findByText(hi.comingSoon);
    const menu = openMenu();
    fireEvent.click(row(menu, hi.bill));
    fireEvent.click(row(menu, hi.newBill));
    expect(screen.getByTestId('bill-total').textContent).toBe('₹380');
  });

  it('keeps the screen behind out of reach while open', async () => {
    await unlock();
    openMenu();
    expect(screen.getByRole('button', { name: hi.lockNow }).closest('[inert]')).not.toBeNull();
    fireEvent.click(screen.getByTestId('drawer-scrim'));
    expect(screen.getByRole('button', { name: hi.lockNow }).closest('[inert]')).toBeNull();
  });

  it('after locking, the next unlock starts on the bill', async () => {
    await unlock();
    fireEvent.click(row(openMenu(), hi.dashboard));
    await screen.findByText(hi.comingSoon);
    fireEvent.click(screen.getByRole('button', { name: hi.lockNow }));
    fireEvent.click(await screen.findByRole('button', { name: /Ramesh/ }));
    for (const digit of '2468') fireEvent.click(screen.getByRole('button', { name: digit }));
    await screen.findByText(hi.companies);
    expect(screen.queryByText(hi.comingSoon)).toBeNull();
  });

  it('the owner row goes to the owner login', async () => {
    await unlock();
    fireEvent.click(row(openMenu(), hi.owner));
    expect(await screen.findByRole('heading', { name: hi.ownerLoginTitle })).toBeTruthy();
  });
});
