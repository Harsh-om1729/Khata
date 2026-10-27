import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { KhataDb, createCompany, createItem } from '../../src/db';
import { hi } from '../../src/i18n';
import type { StaffMember } from '../../src/staff/types';
import { APPROVED_ID, fakeDevice, fakeDeviceAdmin } from './fakes';

const ramesh: StaffMember = { id: 'staff-ramesh', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };
let db: KhataDb;

beforeEach(async () => {
  localStorage.clear();
  db = new KhataDb(`test-${crypto.randomUUID()}`);
  const author = { staff: ramesh, deviceId: APPROVED_ID };
  const ultratech = await createCompany(db, author, { name: 'Ultratech' });
  const acc = await createCompany(db, author, { name: 'ACC' });
  await createItem(db, author, { company_id: ultratech.id, name_hi: 'सीमेंट', name_en: 'Cement', size: '50kg', unit: 'bag', price_paise: 38_000 });
  await createItem(db, author, { company_id: ultratech.id, name_hi: 'सीमेंट', name_en: 'Cement', size: '25kg', unit: 'bag', price_paise: 20_000 });
  await createItem(db, author, { company_id: acc.id, name_hi: 'कील', name_en: 'Nails', size: '2 inch', unit: 'kg', price_paise: 8_050 });
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

const total = () => screen.getByTestId('bill-total').textContent;
const count = () => screen.getByTestId('bill-count').textContent;
const tile = async (text: string) => {
  const tiles = await screen.findAllByTestId('item-tile');
  const found = tiles.find((t) => t.textContent?.includes(text));
  if (!found) throw new Error(`no tile with ${text}`);
  return found;
};
const tap = async (text: string) => fireEvent.click(within(await tile(text)).getAllByRole('button')[0] as HTMLElement);

describe('billing screen (M2-2)', () => {
  it('opens on billing after unlock, with an empty bill strip', async () => {
    await unlock();
    expect(count()).toBe(hi.billEmpty);
    expect(total()).toBe('₹0');
    expect((screen.getByRole('button', { name: hi.undo }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: hi.addCompany })).toBeTruthy();
  });

  it('tapping item tiles adds them to the bill; tapping again adds one more', async () => {
    await unlock();
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    await tap('50kg');
    await tap('50kg');
    await tap('25kg');
    expect((await tile('50kg')).textContent).toContain(`${hi.onBill} 2`);
    expect((await tile('25kg')).textContent).toContain(`${hi.onBill} 1`);
    expect(count()).toBe(`2 ${hi.billItems}`);
    expect(total()).toBe('₹960');
    expect(await db.price_changes.count()).toBe(0);
  });

  it('undo takes back the last tap, one at a time', async () => {
    await unlock();
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    await tap('50kg');
    await tap('25kg');
    await tap('25kg');
    fireEvent.click(screen.getByRole('button', { name: hi.undo }));
    expect(total()).toBe('₹580');
    fireEvent.click(screen.getByRole('button', { name: hi.undo }));
    expect(total()).toBe('₹380');
    expect((await tile('25kg')).textContent).not.toContain(hi.onBill);
    fireEvent.click(screen.getByRole('button', { name: hi.undo }));
    expect(total()).toBe('₹0');
    expect((screen.getByRole('button', { name: hi.undo }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('search finds items across companies, and tapping a result adds it to the same bill', async () => {
    await unlock();
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    await tap('50kg');
    fireEvent.input(screen.getByPlaceholderText(hi.search), { target: { value: 'kil' } });
    expect(await screen.findByText(hi.searchNone)).toBeTruthy();
    fireEvent.input(screen.getByPlaceholderText(hi.search), { target: { value: 'कील' } });
    const nails = await tile('कील');
    expect(nails.textContent).toContain('ACC');
    await tap('कील');
    expect(total()).toBe('₹460.50');
    fireEvent.click(screen.getByRole('button', { name: hi.clearSearch }));
    expect((await tile('50kg')).textContent).toContain(`${hi.onBill} 1`);
  });

  it('locking the phone clears the unsaved bill, so the next person starts fresh', async () => {
    await unlock();
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    await tap('50kg');
    fireEvent.click(screen.getByRole('button', { name: hi.lockNow }));
    fireEvent.click(await screen.findByRole('button', { name: /Ramesh/ }));
    for (const digit of '2468') fireEvent.click(screen.getByRole('button', { name: digit }));
    await screen.findByText(hi.companies);
    expect(total()).toBe('₹0');
  });

  it('"Items and prices" opens item management, where a tap opens the item page instead', async () => {
    await unlock();
    fireEvent.click(screen.getByRole('button', { name: hi.manageItems }));
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    await tap('50kg');
    expect(await screen.findByTestId('current-price')).toBeTruthy();
    expect(screen.queryByTestId('bill-total')).toBeNull();
  });
});
