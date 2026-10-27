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

async function unlock(code: string | null = 'A') {
  render(
    <App
      services={{
        db,
        device: { ...fakeDevice({ id: APPROVED_ID, status: 'approved', code }), cached: () => ({ id: APPROVED_ID, status: 'approved' as const, code }) },
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

describe('bill review: quantity, price for this sale, new default (M2-3)', () => {
  async function billWithCement() {
    await unlock();
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    await tap('50kg');
    fireEvent.click(screen.getByRole('button', { name: hi.seeBill }));
    return screen.findByTestId('bill-line');
  }
  const typeIn = (label: RegExp | string, value: string) => fireEvent.input(screen.getByLabelText(label), { target: { value } });

  it('+ and − change the quantity by one, never below one', async () => {
    const line = await billWithCement();
    expect(within(line).getByTestId('line-qty').textContent).toBe(`1 ${hi.unitBag}`);
    expect((within(line).getByRole('button', { name: hi.lessOne }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(line).getByRole('button', { name: hi.moreOne }));
    fireEvent.click(within(line).getByRole('button', { name: hi.moreOne }));
    expect(within(line).getByTestId('line-qty').textContent).toBe(`3 ${hi.unitBag}`);
    expect(total()).toBe('₹1,140');
    fireEvent.click(within(line).getByRole('button', { name: hi.lessOne }));
    expect(total()).toBe('₹760');
  });

  it('types a part quantity like 2.5, and explains a wrong one', async () => {
    const line = await billWithCement();
    fireEvent.click(within(line).getByRole('button', { name: hi.typeQty }));
    typeIn(new RegExp(hi.typeQty), 'abc');
    fireEvent.click(screen.getByRole('button', { name: hi.ok }));
    expect(await screen.findByText(hi.errorQty)).toBeTruthy();
    typeIn(new RegExp(hi.typeQty), '2.5');
    fireEvent.click(screen.getByRole('button', { name: hi.ok }));
    expect(within(line).getByTestId('line-sum').textContent).toBe('₹380 × 2.5 = ₹950');
    expect(total()).toBe('₹950');
  });

  it('a price changed for this sale is marked in words and leaves the item price alone', async () => {
    const line = await billWithCement();
    fireEvent.click(within(line).getByRole('button', { name: hi.changeLinePrice }));
    typeIn(hi.linePrice, '370');
    fireEvent.click(screen.getByRole('button', { name: hi.ok }));
    expect(total()).toBe('₹370');
    expect(within(line).getByTestId('price-changed').textContent).toContain(`${hi.priceChangedForBill} ₹380`);
    const cement = (await db.items.toArray()).find((i) => i.size === '50kg');
    expect(cement?.price_paise).toBe(38_000);
    expect(await db.price_changes.count()).toBe(0);
  });

  it('"make this the new price" saves it as the item price, logged with who changed it', async () => {
    const line = await billWithCement();
    fireEvent.click(within(line).getByRole('button', { name: hi.changeLinePrice }));
    typeIn(hi.linePrice, '390');
    fireEvent.click(screen.getByRole('button', { name: hi.ok }));
    fireEvent.click(within(line).getByRole('button', { name: hi.makeDefault }));

    expect(await within(line).findByText(hi.defaultSaved)).toBeTruthy();
    expect(within(line).queryByTestId('price-changed')).toBeNull();
    const cement = (await db.items.toArray()).find((i) => i.size === '50kg');
    expect(cement?.price_paise).toBe(39_000);
    expect(await db.price_changes.toArray()).toMatchObject([{ item_id: cement?.id, old_paise: 38_000, new_paise: 39_000, staff_id: 'staff-ramesh' }]);

    fireEvent.click(screen.getByRole('button', { name: hi.addMore }));
    expect((await tile('50kg')).textContent).toContain('₹390');
  });

  it('removes a line, and undo brings it back', async () => {
    await billWithCement();
    fireEvent.click(screen.getByRole('button', { name: hi.removeLine }));
    expect(screen.queryByTestId('bill-line')).toBeNull();
    expect(total()).toBe('₹0');
    fireEvent.click(screen.getByRole('button', { name: hi.undo }));
    expect(await screen.findByTestId('bill-line')).toBeTruthy();
    expect(total()).toBe('₹380');
  });

  it('"add more items" goes back to where you were, and the bill keeps its lines', async () => {
    await billWithCement();
    expect(screen.queryByRole('button', { name: hi.seeBill })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: hi.addMore }));
    await tap('25kg');
    expect(count()).toBe(`2 ${hi.billItems}`);
    expect(screen.getByRole('heading', { name: 'Ultratech' })).toBeTruthy();
  });
});

describe('cash payment and save (M2-5)', () => {
  async function toPayScreen(code: string | null = 'A') {
    await unlock(code);
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    await tap('50kg');
    await tap('50kg');
    fireEvent.click(screen.getByRole('button', { name: hi.seeBill }));
    fireEvent.click(await screen.findByRole('button', { name: hi.takePayment }));
    await screen.findByTestId('pay-total');
  }

  it('the pay screen shows the total in large digits with cash, and nothing else to distract', async () => {
    await toPayScreen();
    expect(screen.getByTestId('pay-total').textContent).toBe('₹760');
    expect((screen.getByLabelText(hi.payCash) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByTestId('bill-total')).toBeNull();
    expect(screen.queryByPlaceholderText(hi.search)).toBeNull();
  });

  it('saving stores the bill, locks the phone, and says it is saved on this phone with its number and total', async () => {
    await toPayScreen();
    fireEvent.click(screen.getByRole('button', { name: hi.saveBill }));

    const notice = await screen.findByTestId('saved-notice');
    expect(notice.textContent).toContain(hi.billSavedOnPhone);
    expect(notice.textContent).toMatch(/A-\d{6}-001/);
    expect(notice.textContent).toContain('₹760');
    expect(screen.getByText(hi.staffChoose)).toBeTruthy();
    expect(screen.queryByTestId('bill-total')).toBeNull();

    const [bill] = await db.bills.toArray();
    expect(bill).toMatchObject({ total_paise: 76_000, staff_id: 'staff-ramesh', device_id: APPROVED_ID });
    expect(await db.payments.toArray()).toMatchObject([{ bill_id: bill?.id, method: 'cash', amount_paise: 76_000 }]);
  });

  it('a double tap on Save makes only one bill', async () => {
    await toPayScreen();
    const save = screen.getByRole('button', { name: hi.saveBill });
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.click(save);
    await screen.findByTestId('saved-notice');
    expect(await db.bills.count()).toBe(1);
    expect(await db.payments.count()).toBe(1);
  });

  it('after the next unlock the notice is gone and the bill is empty', async () => {
    await toPayScreen();
    fireEvent.click(screen.getByRole('button', { name: hi.saveBill }));
    await screen.findByTestId('saved-notice');
    fireEvent.click(screen.getByRole('button', { name: /Ramesh/ }));
    for (const digit of '2468') fireEvent.click(screen.getByRole('button', { name: digit }));
    await screen.findByText(hi.companies);
    expect(screen.queryByTestId('saved-notice')).toBeNull();
    expect(total()).toBe('₹0');
  });

  it('"back to bill" keeps the bill as it was', async () => {
    await toPayScreen();
    fireEvent.click(screen.getByRole('button', { name: hi.backToBill }));
    expect(await screen.findByTestId('bill-line')).toBeTruthy();
    expect(total()).toBe('₹760');
    expect(await db.bills.count()).toBe(0);
  });

  it('a phone with no bill letter cannot save, says why, and keeps the bill to try again', async () => {
    await toPayScreen(null);
    fireEvent.click(screen.getByRole('button', { name: hi.saveBill }));
    expect((await screen.findByRole('alert')).textContent).toContain(hi.errorNoLetter);
    expect(await db.bills.count()).toBe(0);
    expect((screen.getByRole('button', { name: hi.saveBill }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('pay-total').textContent).toBe('₹760');
  });
});

describe('"Not in list? Add new" during billing (M2-6)', () => {
  const typeIn = (label: string, value: string) => fireEvent.input(screen.getByLabelText(label), { target: { value } });

  it('from a search that found nothing: the typed name is filled in, the item is saved and put on the bill', async () => {
    await unlock();
    fireEvent.input(screen.getByPlaceholderText(hi.search), { target: { value: 'पेंट' } });
    expect(await screen.findByText(hi.searchNone)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: hi.notInList }));

    expect((screen.getByLabelText(hi.itemNameHi) as HTMLInputElement).value).toBe('पेंट');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));
    expect(await screen.findByText(hi.errorChooseCompany)).toBeTruthy();

    const acc = (await screen.findByRole('option', { name: 'ACC' })) as HTMLOptionElement;
    fireEvent.change(screen.getByLabelText(hi.companyName), { target: { value: acc.value } });
    typeIn(hi.itemSize, '1 litre');
    typeIn(hi.itemPrice, '260');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));

    expect(await screen.findByText(hi.companies)).toBeTruthy();
    expect(total()).toBe('₹260');
    const paint = (await db.items.toArray()).find((i) => i.name_hi === 'पेंट');
    expect(paint).toMatchObject({ size: '1 litre', price_paise: 26_000, needs_review: true, staff_id: 'staff-ramesh' });
    expect((screen.getByPlaceholderText(hi.search) as HTMLInputElement).value).toBe('');
  });

  it('with a new company typed in, makes the company too', async () => {
    await unlock();
    fireEvent.click(screen.getByRole('button', { name: hi.notInList }));
    fireEvent.change(screen.getByLabelText(hi.companyName), { target: { value: '__new__' } });
    typeIn(hi.newCompanyName, 'Asian Paints');
    typeIn(hi.itemNameEn, 'Primer');
    typeIn(hi.itemPrice, '180');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));

    expect(await screen.findByRole('button', { name: /Asian Paints/ })).toBeTruthy();
    expect(total()).toBe('₹180');
    expect(count()).toBe(`1 ${hi.billItems}`);
  });

  it('inside a company it uses that company, and + Item there also puts the new item on the bill', async () => {
    await unlock();
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    fireEvent.click(screen.getByRole('button', { name: hi.notInList }));
    expect(screen.queryByLabelText(hi.companyName)).toBeNull();
    typeIn(hi.itemNameHi, 'सीमेंट');
    typeIn(hi.itemSize, '10kg');
    typeIn(hi.itemPrice, '90');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));
    expect((await tile('10kg')).textContent).toContain(`${hi.onBill} 1`);

    fireEvent.click(screen.getByRole('button', { name: hi.addItem }));
    typeIn(hi.itemNameHi, 'सीमेंट');
    typeIn(hi.itemSize, '3kg');
    typeIn(hi.itemPrice, '50');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));
    expect((await tile('3kg')).textContent).toContain(`${hi.onBill} 1`);
    expect(total()).toBe('₹140');
  });

  it('"remove last" takes the new item off the bill, and the item stays in the list', async () => {
    await unlock();
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    fireEvent.click(screen.getByRole('button', { name: hi.notInList }));
    typeIn(hi.itemNameHi, 'सीमेंट');
    typeIn(hi.itemSize, '10kg');
    typeIn(hi.itemPrice, '90');
    fireEvent.click(screen.getByRole('button', { name: hi.save }));
    await tile('10kg');
    fireEvent.click(screen.getByRole('button', { name: hi.undo }));
    expect(total()).toBe('₹0');
    expect((await tile('10kg')).textContent).not.toContain(hi.onBill);
  });

  it('back from the form changes nothing', async () => {
    await unlock();
    fireEvent.click(screen.getByRole('button', { name: hi.notInList }));
    fireEvent.click(screen.getByRole('button', { name: hi.back }));
    expect(await screen.findByText(hi.companies)).toBeTruthy();
    expect(await db.items.count()).toBe(3);
    expect(total()).toBe('₹0');
  });
});

describe('on-screen bill and bill history (M2-8)', () => {
  async function saveOne() {
    await unlock();
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    await tap('50kg');
    await tap('50kg');
    await tap('25kg');
    fireEvent.click(screen.getByRole('button', { name: hi.seeBill }));
    const line = (await screen.findAllByTestId('bill-line'))[1];
    if (!line) throw new Error('missing line');
    fireEvent.click(within(line).getByRole('button', { name: hi.changeLinePrice }));
    fireEvent.input(screen.getByLabelText(hi.linePrice), { target: { value: '195' } });
    fireEvent.click(screen.getByRole('button', { name: hi.ok }));
    fireEvent.click(screen.getByRole('button', { name: hi.takePayment }));
    fireEvent.click(await screen.findByRole('button', { name: hi.saveBill }));
    await screen.findByTestId('saved-notice');
  }

  it('"show bill" right after saving shows that bill without a PIN, then goes back to the staff tiles', async () => {
    await saveOne();
    fireEvent.click(screen.getByRole('button', { name: hi.showBill }));
    const receipt = await screen.findByTestId('receipt');
    expect(receipt.textContent).toMatch(/A-\d{6}-001/);
    expect(receipt.textContent).toContain('Ramesh');
    const lines = within(receipt).getAllByTestId('receipt-line').map((l) => l.textContent);
    expect(lines).toEqual(['सीमेंट 50kg2 × ₹380 = ₹760', 'सीमेंट 25kg1 × ₹195 = ₹195']);
    expect(within(receipt).getByTestId('receipt-total').textContent).toBe('₹955');
    expect(receipt.textContent).toContain(`${hi.payCash}: ₹955`);
    expect(screen.queryByText(hi.staffChoose)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: hi.close }));
    expect(await screen.findByText(hi.staffChoose)).toBeTruthy();
    expect(screen.getByTestId('saved-notice')).toBeTruthy();
  });

  it('old bills: listed newest first; tapping one opens it; back keeps the bill being made', async () => {
    await saveOne();
    fireEvent.click(screen.getByRole('button', { name: /Ramesh/ }));
    for (const digit of '2468') fireEvent.click(screen.getByRole('button', { name: digit }));
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    await tap('50kg');

    fireEvent.click(screen.getByRole('button', { name: hi.billHistory }));
    const rows = await screen.findAllByTestId('history-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('₹955');
    expect(rows[0]?.textContent).toContain(hi.payCash);
    fireEvent.click(rows[0] as HTMLElement);
    expect(within(await screen.findByTestId('receipt')).getByTestId('receipt-total').textContent).toBe('₹955');

    fireEvent.click(screen.getByRole('button', { name: hi.close }));
    fireEvent.click(await screen.findByRole('button', { name: hi.back }));
    expect(await screen.findByRole('heading', { name: 'Ultratech' })).toBeTruthy();
    expect(total()).toBe('₹380');
  });

  it('says so when there are no bills yet', async () => {
    await unlock();
    fireEvent.click(screen.getByRole('button', { name: hi.billHistory }));
    expect(await screen.findByText(hi.billHistoryEmpty)).toBeTruthy();
  });
});
