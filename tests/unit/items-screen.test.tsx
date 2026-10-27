import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { KhataDb, createCompany, createItem } from '../../src/db';
import { hi } from '../../src/i18n';
import type { StaffMember } from '../../src/staff/types';
import { APPROVED_ID, fakeDevice, fakeDeviceAdmin } from './fakes';

const ramesh: StaffMember = { id: 'staff-ramesh', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };
const author = { staff: ramesh, deviceId: APPROVED_ID };
let db: KhataDb;

async function seed() {
  const ultratech = await createCompany(db, author, { name: 'Ultratech' });
  const acc = await createCompany(db, author, { name: 'ACC' });
  await createItem(db, author, { company_id: ultratech.id, name_en: 'Cement', size: '50kg', unit: 'bag', price_paise: 38_000, category: 'Cement' });
  await createItem(db, author, { company_id: ultratech.id, name_en: 'Cement', size: '25kg', unit: 'bag', price_paise: 20_000, category: 'Cement' });
  await createItem(db, author, { company_id: acc.id, name_en: 'Nails', size: '2 inch', unit: 'kg', price_paise: 8_050 });
}

beforeEach(() => {
  localStorage.clear();
  db = new KhataDb(`test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  cleanup();
  await db.delete();
});

async function openItems() {
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
  fireEvent.click(await screen.findByRole('button', { name: hi.manageItems }));
  await screen.findByRole('heading', { name: hi.manageItems });
}

const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const rows = async () => (await screen.findAllByTestId('item-row')).map((r) => r.textContent ?? '');
// The bill screen waits hidden behind with its own search box, so look only inside the items screen.
const catalog = () => screen.getByRole('heading', { name: hi.manageItems }).closest('section') as HTMLElement;
const search = (label: string, value: string) => fireEvent.input(within(catalog()).getByLabelText(label), { target: { value } });
const sheet = () => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(hi.filter) }));
  return screen.getByRole('dialog', { name: hi.filterTitle });
};
/** Back to billing, where the bill screen is still on the company it last showed. */
const billingTiles = async ({ openCompany = true } = {}) => {
  fireEvent.click(screen.getAllByRole('button', { name: hi.back })[0] as HTMLElement);
  if (openCompany) fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
  return (await screen.findAllByTestId('item-tile')).map((t) => t.textContent ?? '');
};

describe('items screen (U-3)', () => {
  it('opens on companies, and the floating add button follows the tab', async () => {
    await seed();
    await openItems();
    expect(screen.getByRole('tab', { name: hi.tabCompanies }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: hi.addCompany })).toBeTruthy();
    tab(hi.tabItems);
    expect(screen.getByRole('button', { name: hi.addItem })).toBeTruthy();
    expect(screen.queryByRole('button', { name: hi.addCompany })).toBeNull();
    tab(hi.tabCategories);
    expect(screen.queryByRole('button', { name: hi.addItem })).toBeNull();
  });

  it('shows a picture and one sentence when there is nothing yet', async () => {
    await openItems();
    expect(await screen.findByText(hi.companiesEmpty)).toBeTruthy();
    tab(hi.tabItems);
    expect(await screen.findByText(hi.itemsNone)).toBeTruthy();
    tab(hi.tabCategories);
    expect(await screen.findByText(hi.categoriesNone)).toBeTruthy();
  });

  it('lists items with company, size and price, and searches as you type', async () => {
    await seed();
    await openItems();
    tab(hi.tabItems);
    const listed = await rows();
    expect(listed).toHaveLength(3);
    expect(listed[0]).toContain('Cement');
    expect(listed[0]).toContain('25kg · Ultratech');
    expect(listed[0]).toContain('₹200');
    search(hi.search, 'nai');
    expect(await rows()).toEqual([expect.stringContaining('Nails')]);
    search(hi.search, 'paint');
    expect(await screen.findByText(hi.searchNone)).toBeTruthy();
  });

  it('a new tab starts with an empty search', async () => {
    await seed();
    await openItems();
    search(hi.searchCompanies, 'ultra');
    tab(hi.tabItems);
    expect((within(catalog()).getByLabelText(hi.search) as HTMLInputElement).value).toBe('');
  });

  it('filters by company and sorts by price', async () => {
    await seed();
    await openItems();
    tab(hi.tabItems);
    const filters = sheet();
    fireEvent.click(within(filters).getByLabelText(hi.sortPriceHigh));
    expect((await rows()).map((r) => r.match(/₹[\d.,]+/)?.[0])).toEqual(['₹380', '₹200', '₹80.50']);
    fireEvent.change(within(filters).getByLabelText(hi.tabCompanies), { target: { value: (await db.companies.where('name').equals('ACC').first())?.id } });
    expect(await rows()).toHaveLength(1);
    fireEvent.click(within(filters).getByRole('button', { name: hi.ok }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: `${hi.filter} (2)` })).toBeTruthy();
    fireEvent.click(within(sheet()).getByRole('button', { name: hi.clearFilters }));
    expect(await rows()).toHaveLength(3);
  });

  it('a category opens the items in it; units show their counts', async () => {
    await seed();
    await openItems();
    tab(hi.tabCategories);
    fireEvent.click(await screen.findByRole('button', { name: /Cement/ }));
    expect(screen.getByRole('tab', { name: hi.tabItems }).getAttribute('aria-selected')).toBe('true');
    expect(await rows()).toHaveLength(2);
    tab(hi.tabUnits);
    expect(screen.getByText(hi.unitBag).closest('li')?.textContent).toContain(`2 ${hi.countItems}`);
  });

  it('adds an item from the items tab, choosing its company', async () => {
    await seed();
    await openItems();
    tab(hi.tabItems);
    fireEvent.click(screen.getByRole('button', { name: hi.addItem }));
    await screen.findByRole('option', { name: 'ACC' });
    fireEvent.change(screen.getByLabelText(hi.companyName), { target: { value: (await db.companies.where('name').equals('ACC').first())?.id } });
    fireEvent.input(screen.getByLabelText(hi.itemNameEn), { target: { value: 'Wire' } });
    fireEvent.input(screen.getByLabelText(hi.itemPrice), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: hi.save }));
    expect((await screen.findByTestId('current-price')).textContent).toContain('₹15');
    fireEvent.click(screen.getByRole('button', { name: hi.back }));
    expect(await rows()).toHaveLength(4);
  });
});

describe('remove and bring back (U-3 done check)', () => {
  it('a removed item disappears from billing and comes back after "Bring back"', async () => {
    await seed();
    await openItems();
    tab(hi.tabItems);
    fireEvent.click((await screen.findAllByTestId('item-row'))[1]?.querySelector('button') as HTMLElement);
    await screen.findByTestId('current-price');

    fireEvent.click(screen.getByRole('button', { name: hi.removeItem }));
    expect(screen.getByText(hi.confirmRemoveItem)).toBeTruthy();
    expect((await db.items.toArray()).some((i) => i.archived)).toBe(false);
    fireEvent.click(within(screen.getByRole('group', { name: hi.removeItem })).getByRole('button', { name: hi.removeItem }));
    expect(await screen.findByText(hi.removedTag)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: hi.back }));
    await waitFor(async () => expect(await rows()).toHaveLength(2));
    expect(await billingTiles()).toEqual([expect.stringContaining('25kg')]);

    fireEvent.click(screen.getByRole('button', { name: hi.manageItems }));
    tab(hi.tabItems);
    fireEvent.click(within(sheet()).getByLabelText(hi.showArchived));
    fireEvent.click(screen.getByRole('button', { name: hi.ok }));
    const removed = await screen.findByTestId('item-row');
    expect(removed.textContent).toContain('50kg');
    fireEvent.click(within(removed).getByRole('button', { name: hi.restore }));
    expect(await screen.findByText(hi.removedNone)).toBeTruthy();

    await billingTiles({ openCompany: false });
    await waitFor(async () => expect(await screen.findAllByTestId('item-tile')).toHaveLength(2));
    expect(await db.outbox.where('table').equals('items').count()).toBe(5);
  });

  it('cancel keeps the item', async () => {
    await seed();
    await openItems();
    tab(hi.tabItems);
    fireEvent.click((await screen.findAllByTestId('item-row'))[0]?.querySelector('button') as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: hi.removeItem }));
    fireEvent.click(screen.getByRole('button', { name: hi.cancel }));
    expect(screen.queryByText(hi.confirmRemoveItem)).toBeNull();
    expect((await db.items.toArray()).some((i) => i.archived)).toBe(false);
  });

  it('a removed company hides its items; its items wait in the removed list until the company comes back', async () => {
    await seed();
    await openItems();
    fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
    fireEvent.click(await screen.findByRole('button', { name: hi.removeCompany }));
    fireEvent.click(within(screen.getByRole('group', { name: hi.removeCompany })).getByRole('button', { name: hi.removeCompany }));
    expect(await within(await screen.findByRole('heading', { name: hi.manageItems }).then(catalog)).findByRole('button', { name: /ACC/ })).toBeTruthy();
    await waitFor(() => expect(within(catalog()).queryByRole('button', { name: /Ultratech/ })).toBeNull());

    tab(hi.tabItems);
    fireEvent.click(within(sheet()).getByLabelText(hi.showArchived));
    fireEvent.click(screen.getByRole('button', { name: hi.ok }));
    const removed = await screen.findAllByTestId('item-row');
    expect(removed).toHaveLength(2);
    expect(removed[0]?.textContent).toContain(hi.companyRemovedHint);
    expect(within(removed[0] as HTMLElement).queryByRole('button', { name: hi.restore })).toBeNull();

    tab(hi.tabCompanies);
    fireEvent.click(await screen.findByRole('button', { name: hi.restore }));
    expect(await screen.findByText(hi.removedNone)).toBeTruthy();
    fireEvent.click(within(sheet()).getByLabelText(hi.showArchived));
    expect(await screen.findByRole('button', { name: /Ultratech/ })).toBeTruthy();
  });
});
