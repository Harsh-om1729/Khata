import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { KhataDb, createCompany } from '../../src/db';
import { hi } from '../../src/i18n';
import type { StaffMember } from '../../src/staff/types';
import { APPROVED_ID, fakeDevice, fakeDeviceAdmin } from './fakes';

const member = (id: string, name: string, extra: Partial<StaffMember> = {}): StaffMember => ({
  id, name, photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null, ...extra,
});
const ramesh = member('staff-ramesh', 'Ramesh');
const owner = member('staff-owner', 'Harsh', { is_owner: true });

let db: KhataDb;

beforeEach(() => {
  localStorage.clear();
  db = new KhataDb(`test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  cleanup();
  await db.delete();
});

async function unlockAs(who: StaffMember) {
  const device = { ...fakeDevice({ id: APPROVED_ID, status: 'approved', code: 'A' }), cached: () => ({ id: APPROVED_ID, status: 'approved' as const, code: 'A' }) };
  render(
    <App
      services={{
        db,
        device,
        deviceAdmin: fakeDeviceAdmin(),
        staffDirectory: { cached: () => [ramesh, owner], refresh: async () => [ramesh, owner] },
        staffLogin: { login: vi.fn(async () => ({ kind: 'ok' as const })), lockedUntil: () => null },
      }}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(who.name) }));
  for (const digit of '2468') fireEvent.click(screen.getByRole('button', { name: digit }));
  await screen.findByText(hi.companies);
}

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.input(input(label), { target: { value } });

describe('company grid and add forms (M1-2)', () => {
  it('shows no catalog until a staff member unlocks', async () => {
    render(<App services={{ db, device: fakeDevice({ id: APPROVED_ID, status: 'approved', code: 'A' }), deviceAdmin: fakeDeviceAdmin(), staffDirectory: { cached: () => [ramesh], refresh: async () => [ramesh] } }} />);
    expect(await screen.findByText(hi.staffChoose)).toBeTruthy();
    expect(screen.queryByText(hi.companies)).toBeNull();
  });

  it('adds a company, opens it, adds an item, and shows the item tile', async () => {
    await unlockAs(ramesh);
    expect(await screen.findByText(hi.companiesEmpty)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: hi.addCompany }));
    type(hi.companyName, 'Ultratech');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));

    fireEvent.click(await screen.findByRole('button', { name: hi.addItem }));
    type(hi.itemNameHi, 'सीमेंट');
    type(hi.itemSize, '50kg');
    fireEvent.click(screen.getByLabelText(hi.unitBag));
    type(hi.itemPrice, '420.50');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));

    const tile = await screen.findByTestId('item-tile');
    expect(tile.textContent).toContain('सीमेंट');
    expect(tile.textContent).toContain('50kg');
    expect(tile.textContent).toContain('₹420.50');
    expect(tile.textContent).toContain(hi.needsReview);

    const [item] = await db.items.toArray();
    expect(item).toMatchObject({ unit: 'bag', price_paise: 42_050, staff_id: 'staff-ramesh', device_id: APPROVED_ID });
    expect(await db.outbox.count()).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: hi.back }));
    expect(await screen.findByRole('button', { name: /Ultratech/ })).toBeTruthy();
  });

  it('does not mark items added by the owner for review', async () => {
    await createCompany(db, { staff: owner, deviceId: APPROVED_ID }, { name: 'Ultratech' });
    await unlockAs(owner);
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    fireEvent.click(await screen.findByRole('button', { name: hi.addItem }));
    type(hi.itemNameEn, 'Cement');
    type(hi.itemPrice, '420');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));
    const tile = await screen.findByTestId('item-tile');
    expect(tile.textContent).not.toContain(hi.needsReview);
  });

  it('explains what is wrong instead of saving: no name, bad price, duplicate', async () => {
    await createCompany(db, { staff: owner, deviceId: APPROVED_ID }, { name: 'Ultratech' });
    await unlockAs(ramesh);

    fireEvent.click(screen.getByRole('button', { name: hi.addCompany }));
    fireEvent.click(screen.getByRole('button', { name: hi.save }));
    expect((await screen.findByRole('alert')).textContent).toContain(hi.errorCompanyName);
    type(hi.companyName, 'ultratech');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));
    expect((await screen.findByText(hi.errorDuplicateCompany))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: hi.back }));

    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    fireEvent.click(await screen.findByRole('button', { name: hi.addItem }));
    type(hi.itemPrice, '420');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));
    expect(await screen.findByText(hi.errorItemName)).toBeTruthy();

    type(hi.itemNameEn, 'Cement');
    type(hi.itemPrice, '4.205');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));
    expect(await screen.findByText(hi.errorPrice)).toBeTruthy();
    expect(await db.items.count()).toBe(0);
  });
});
