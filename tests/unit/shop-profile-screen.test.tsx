import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { KhataDb, createCompany, createItem, saveShopProfile, shopProfile } from '../../src/db';
import { hi } from '../../src/i18n';
import { emptyProfile, gstinCheckChar } from '../../src/profile';
import type { StaffMember } from '../../src/staff/types';
import { APPROVED_ID, fakeDevice, fakeDeviceAdmin } from './fakes';

const ramesh: StaffMember = { id: 'staff-ramesh', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };
const author = { staff: ramesh, deviceId: APPROVED_ID };
const BIHAR_GSTIN = `10AABCU9603R1Z${gstinCheckChar('10AABCU9603R1Z')}`;
const SHOP_NAME = `${hi.fieldShopName} (${hi.required})`;
let db: KhataDb;

beforeEach(() => {
  localStorage.clear();
  db = new KhataDb(`test-${crypto.randomUUID()}`);
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

async function openProfile() {
  fireEvent.click(screen.getByRole('button', { name: hi.menu }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: hi.shopProfile }));
  return screen.findByRole('heading', { name: hi.shopProfile });
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.input(field(label), { target: { value } });
const percent = () => screen.getByRole('progressbar').getAttribute('aria-valuenow');
const save = () => fireEvent.click(screen.getByRole('button', { name: hi.save }));
const onBill = () => screen.getByTestId('bill-total').closest('[hidden]') === null;

describe('shop profile screen (U-4)', () => {
  it('opens from the menu with every field, and the completion follows what is typed', async () => {
    await unlock();
    await openProfile();
    for (const label of [SHOP_NAME, hi.fieldPhone1, hi.fieldPhone2, hi.fieldAddress, hi.fieldPincode, hi.fieldState, hi.fieldGstin]) {
      expect(field(label)).toBeTruthy();
    }
    expect(percent()).toBe('0');
    expect(screen.getByText('0%')).toBeTruthy();
    type(SHOP_NAME, 'Anand Hardware');
    expect(percent()).toBe('14');
    fireEvent.change(field(hi.fieldState), { target: { value: '10' } });
    expect(percent()).toBe('29');
    expect(within(field(hi.fieldState)).getByRole('option', { name: 'बिहार' })).toBeTruthy();
  });

  it('saves, says so, and shows the cleaned values next time', async () => {
    await unlock();
    await openProfile();
    type(SHOP_NAME, '  Anand   Hardware ');
    type(hi.fieldPhone1, '+91 98765 43210');
    type(hi.fieldPincode, '800 001');
    fireEvent.change(field(hi.fieldState), { target: { value: '10' } });
    type(hi.fieldGstin, BIHAR_GSTIN.toLowerCase());
    expect(field(hi.fieldGstin).value).toBe(BIHAR_GSTIN);
    save();

    expect((await screen.findByText(hi.profileSaved)).closest('[role="status"]')).not.toBeNull();
    expect(await shopProfile(db)).toMatchObject({ shop_name: 'Anand Hardware', phone1: '9876543210', pincode: '800001', state: '10', gstin: BIHAR_GSTIN });
    expect(field(SHOP_NAME).value).toBe('Anand Hardware');
    expect(field(hi.fieldPhone1).value).toBe('9876543210');

    type(hi.fieldPincode, '800002');
    fireEvent.click(screen.getByRole('button', { name: hi.cancel }));
    expect(screen.queryByText(hi.profileSaved)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: hi.discardChanges }));
    expect(onBill()).toBe(true);
    await openProfile();
    expect(field(hi.fieldPincode).value).toBe('800001');
    expect(percent()).toBe('71');
  });

  it('writes each mistake under its box, saves nothing, and clears a mistake once it is being fixed', async () => {
    await unlock();
    await openProfile();
    type(hi.fieldPhone1, '12345');
    type(hi.fieldGstin, '10AABCU9603R1ZZ');
    save();

    expect((await screen.findAllByRole('alert'))[0]?.textContent).toContain(hi.fixMistakes);
    expect(screen.getByText(hi.errorShopName)).toBeTruthy();
    expect(screen.getByText(hi.errorPhone)).toBeTruthy();
    expect(screen.getByText(hi.errorGstin)).toBeTruthy();
    expect(field(SHOP_NAME).getAttribute('aria-invalid')).toBe('true');
    expect(field(SHOP_NAME).getAttribute('aria-describedby')).toBe(screen.getByText(hi.errorShopName).id);
    expect(document.activeElement).toBe(field(SHOP_NAME));
    expect(await db.settings_changes.count()).toBe(0);

    type(hi.fieldPhone1, '98765');
    expect(screen.queryByText(hi.errorPhone)).toBeNull();
    expect(screen.getByText(hi.errorShopName)).toBeTruthy();
  });

  it('a GSTIN from another state is caught', async () => {
    await unlock();
    await openProfile();
    type(SHOP_NAME, 'Anand Hardware');
    fireEvent.change(field(hi.fieldState), { target: { value: '20' } });
    type(hi.fieldGstin, BIHAR_GSTIN);
    save();
    expect(await screen.findByText(hi.errorGstinState)).toBeTruthy();
  });

  it('cancel with nothing changed goes straight back to the bill', async () => {
    await unlock();
    await openProfile();
    fireEvent.click(screen.getByRole('button', { name: hi.cancel }));
    expect(onBill()).toBe(true);
  });

  it('cancel and back both warn about unsaved changes; keep editing keeps them, leaving drops them', async () => {
    await saveShopProfile(db, author, { ...emptyProfile(), shop_name: 'Anand Hardware' });
    await unlock();
    await openProfile();
    await waitFor(() => expect(field(SHOP_NAME).value).toBe('Anand Hardware'));
    type(SHOP_NAME, 'Anand Hardware Store');

    fireEvent.click(screen.getByRole('button', { name: hi.cancel }));
    expect(screen.getByRole('alertdialog', { name: hi.unsavedQuestion })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: hi.keepEditing }));
    expect(field(SHOP_NAME).value).toBe('Anand Hardware Store');

    fireEvent.click(screen.getByRole('button', { name: hi.back }));
    fireEvent.click(screen.getByRole('button', { name: hi.discardChanges }));
    expect(onBill()).toBe(true);
    expect((await shopProfile(db)).shop_name).toBe('Anand Hardware');
  });
});

describe('shop profile on the bill (U-4)', () => {
  async function saveBill() {
    const company = await createCompany(db, author, { name: 'Ultratech' });
    await createItem(db, author, { company_id: company.id, name_en: 'Cement', size: '50kg', unit: 'bag', price_paise: 38_000 });
    await unlock();
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    const tiles = await screen.findAllByTestId('item-tile');
    fireEvent.click(within(tiles[0] as HTMLElement).getAllByRole('button')[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: hi.seeBill }));
    fireEvent.click(await screen.findByRole('button', { name: hi.takePayment }));
    fireEvent.click(await screen.findByRole('button', { name: hi.saveBill }));
    fireEvent.click(await screen.findByRole('button', { name: hi.showBill }));
    return screen.findByTestId('receipt');
  }

  it('the top of the bill shows the shop name, address, phones and GSTIN', async () => {
    await saveShopProfile(db, author, {
      shop_name: 'Anand Hardware', gstin: BIHAR_GSTIN, phone1: '9876543210', phone2: '6122345678',
      address: 'Station Road', pincode: '800001', state: '10',
    });
    const receipt = await saveBill();
    const header = await within(receipt).findByTestId('shop-header');
    expect(header.textContent).toContain('Anand Hardware');
    expect(header.textContent).toContain('Station Road, बिहार 800001');
    expect(header.textContent).toContain(`${hi.phoneShort}: 98765 43210, 61223 45678`);
    expect(header.textContent).toContain(`GSTIN: ${BIHAR_GSTIN}`);
  });

  it('shows only what is filled in', async () => {
    await saveShopProfile(db, author, { ...emptyProfile(), shop_name: 'Anand Hardware' });
    const header = await within(await saveBill()).findByTestId('shop-header');
    expect(header.textContent).toBe('Anand Hardware');
  });

  it('has no shop header before the shop name is saved', async () => {
    const receipt = await saveBill();
    expect(within(receipt).getByTestId('receipt-total').textContent).toBe('₹380');
    expect(within(receipt).queryByTestId('shop-header')).toBeNull();
  });
});
