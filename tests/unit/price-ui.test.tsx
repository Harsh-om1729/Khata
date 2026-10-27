import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { KhataDb, createCompany, createItem } from '../../src/db';
import { hi } from '../../src/i18n';
import type { StaffMember } from '../../src/staff/types';
import { APPROVED_ID, fakeDevice, fakeDeviceAdmin } from './fakes';

const owner: StaffMember = { id: 'staff-owner', name: 'Harsh', photo: null, is_owner: true, active: true, pin_version: 1, removed_at: null };
const ramesh: StaffMember = { ...owner, id: 'staff-ramesh', name: 'Ramesh', is_owner: false };
let db: KhataDb;

beforeEach(async () => {
  localStorage.clear();
  db = new KhataDb(`test-${crypto.randomUUID()}`);
  const author = { staff: owner, deviceId: APPROVED_ID };
  const company = await createCompany(db, author, { name: 'Ultratech' });
  await createItem(db, author, { company_id: company.id, name_en: 'Cement', size: '50kg', price_paise: 40_000 });
});
afterEach(async () => {
  cleanup();
  await db.delete();
});

async function openItemAs(who: StaffMember) {
  const device = { ...fakeDevice({ id: APPROVED_ID, status: 'approved', code: 'A' }), cached: () => ({ id: APPROVED_ID, status: 'approved' as const, code: 'A' }) };
  render(
    <App
      services={{
        db,
        device,
        deviceAdmin: fakeDeviceAdmin(),
        staffDirectory: { cached: () => [owner, ramesh], refresh: async () => [owner, ramesh] },
        staffLogin: { login: vi.fn(async () => ({ kind: 'ok' as const })), lockedUntil: () => null },
      }}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(who.name) }));
  for (const digit of '2468') fireEvent.click(screen.getByRole('button', { name: digit }));
  fireEvent.click(await screen.findByRole('button', { name: hi.manageItems }));
  fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Cement/ }));
  await screen.findByTestId('current-price');
}

const setPrice = (value: string) => {
  fireEvent.input(screen.getByLabelText(hi.newPrice), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: hi.changePrice }));
};

describe('price change screen (M1-4)', () => {
  it('opens an item from its tile and shows the price and an empty history', async () => {
    await openItemAs(ramesh);
    expect(screen.getByTestId('current-price').textContent).toContain('₹400');
    expect(await screen.findByText(hi.priceHistoryEmpty)).toBeTruthy();
  });

  it('changes the price and shows who changed it, and old and new', async () => {
    await openItemAs(ramesh);
    setPrice('420');
    await waitFor(() => expect(screen.getByTestId('current-price').textContent).toContain('₹420'));
    const row = await screen.findByTestId('price-change');
    expect(row.textContent).toContain('₹400 → ₹420');
    expect(row.textContent).toContain('Ramesh');
    expect((screen.getByLabelText(hi.newPrice) as HTMLInputElement).value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: hi.back }));
    expect((await screen.findByTestId('item-tile')).textContent).toContain('₹420');
  });

  it('explains a bad or unchanged price instead of saving', async () => {
    await openItemAs(owner);
    setPrice('4.205');
    expect(await screen.findByText(hi.errorPrice)).toBeTruthy();
    setPrice('400');
    expect(await screen.findByText(hi.priceSame)).toBeTruthy();
    expect(await db.price_changes.count()).toBe(0);
  });
});
