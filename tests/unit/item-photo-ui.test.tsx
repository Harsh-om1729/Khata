import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { KhataDb, createCompany, createItem } from '../../src/db';
import { hi } from '../../src/i18n';
import type { StaffMember } from '../../src/staff/types';
import { APPROVED_ID, fakeDevice, fakeDeviceAdmin } from './fakes';

// jsdom cannot decode or draw images; the real compressor is covered by the e2e test.
vi.mock('../../src/pictures/compress', async (original) => ({
  ...(await original<typeof import('../../src/pictures/compress')>()),
  compressPhoto: vi.fn(async () => new Blob(['small'], { type: 'image/webp' })),
}));

const owner: StaffMember = { id: 'staff-owner', name: 'Harsh', photo: null, is_owner: true, active: true, pin_version: 1, removed_at: null };
const author = { staff: owner, deviceId: APPROVED_ID };
let db: KhataDb;

beforeEach(() => {
  localStorage.clear();
  db = new KhataDb(`test-${crypto.randomUUID()}`);
  URL.createObjectURL = vi.fn(() => `blob:photo-${crypto.randomUUID()}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(async () => {
  cleanup();
  await db.delete();
});

async function openCompany() {
  const device = { ...fakeDevice({ id: APPROVED_ID, status: 'approved', code: 'A' }), cached: () => ({ id: APPROVED_ID, status: 'approved' as const, code: 'A' }) };
  render(
    <App
      services={{
        db,
        device,
        deviceAdmin: fakeDeviceAdmin(),
        staffDirectory: { cached: () => [owner], refresh: async () => [owner] },
        staffLogin: { login: vi.fn(async () => ({ kind: 'ok' as const })), lockedUntil: () => null },
      }}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Harsh/ }));
  for (const digit of '2468') fireEvent.click(screen.getByRole('button', { name: digit }));
  fireEvent.click(await screen.findByRole('button', { name: /Ultratech/ }));
}

const camera = async (label: string) => (await screen.findByLabelText(label)) as HTMLInputElement;
const shoot = (input: HTMLInputElement) =>
  fireEvent.change(input, { target: { files: [new File(['big'], 'photo.jpg', { type: 'image/jpeg' })] } });

describe('item pictures in the app (M1-3 done check)', () => {
  it('renders an item with a picture and an item without one', async () => {
    const company = await createCompany(db, author, { name: 'Ultratech' });
    await createItem(db, author, { company_id: company.id, name_en: 'Cement', price_paise: 100 }, new Blob(['p'], { type: 'image/webp' }));
    await createItem(db, author, { company_id: company.id, name_en: 'Rod', price_paise: 100 });
    await openCompany();

    const tiles = await screen.findAllByTestId('item-tile');
    const cement = tiles.find((t) => t.textContent?.includes('Cement'));
    const rod = tiles.find((t) => t.textContent?.includes('Rod'));
    await waitFor(() => expect(cement?.querySelector('img.tile__photo')).not.toBeNull());
    expect(cement?.textContent).toContain(hi.changePhoto);
    expect(rod?.querySelector('img')).toBeNull();
    expect(rod?.querySelector('.tile__avatar')?.textContent).toBe('R');
    expect(rod?.textContent).toContain(hi.takePhoto);
  });

  it('takes a photo for an item that has none', async () => {
    const company = await createCompany(db, author, { name: 'Ultratech' });
    const item = await createItem(db, author, { company_id: company.id, name_en: 'Rod', price_paise: 100 });
    await openCompany();

    shoot(await camera(hi.takePhoto));
    await waitFor(async () => expect((await db.items.get(item.id))?.picture).toMatch(/^items\//));
    const tile = await screen.findByTestId('item-tile');
    await waitFor(() => expect(tile.querySelector('img.tile__photo')).not.toBeNull());
  });

  it('adds a photo in the add-item form, previews it, and saves it with the item', async () => {
    await createCompany(db, author, { name: 'Ultratech' });
    await openCompany();
    fireEvent.click(await screen.findByRole('button', { name: hi.addItem }));
    fireEvent.input(screen.getByLabelText(hi.itemNameEn), { target: { value: 'Cement' } });
    fireEvent.input(screen.getByLabelText(hi.itemPrice), { target: { value: '420' } });
    shoot(await camera(hi.takePhoto));
    expect(await screen.findByAltText(hi.photoAdded)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: hi.save }));

    await screen.findByTestId('item-tile');
    const [item] = await db.items.toArray();
    const saved = await db.pictures.get(item?.picture ?? '');
    expect(saved && new TextDecoder().decode(saved.bytes)).toBe('small');
  });
});
