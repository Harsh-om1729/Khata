import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { addItem, emptyBill, saveCashBill } from '../../src/bill';
import { KhataDb, createCompany, createItem, type Author } from '../../src/db';
import { createStorageGuard } from '../../src/db/persist';
import { OLD_UNSYNCED_MS, isOld, unsyncedBills } from '../../src/db/unsynced';
import { hi } from '../../src/i18n';
import type { StaffMember } from '../../src/staff/types';
import { APPROVED_ID, fakeDevice, fakeDeviceAdmin } from './fakes';

const ramesh: StaffMember = { id: 'staff-ramesh', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };
const author: Author = { staff: ramesh, deviceId: APPROVED_ID };
const HOUR = 60 * 60 * 1000;
let db: KhataDb;

beforeEach(() => {
  localStorage.clear();
  db = new KhataDb(`test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  cleanup();
  await db.delete();
});

async function billAt(when: Date) {
  const company = (await db.companies.toArray())[0] ?? (await createCompany(db, author, { name: 'Ultratech' }));
  const item = (await db.items.toArray())[0] ?? (await createItem(db, author, { company_id: company.id, name_en: 'Cement', price_paise: 38_000 }));
  return saveCashBill(db, author, 'A', addItem(emptyBill(), item), when);
}

describe('asking the phone to keep the data (M2-7)', () => {
  it('is kept when already promised, without asking again', async () => {
    const persist = vi.fn(async () => false);
    expect(await createStorageGuard({ persisted: async () => true, persist }).persist()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('asks when not yet promised, and reports the answer', async () => {
    expect(await createStorageGuard({ persisted: async () => false, persist: async () => true }).persist()).toBe(true);
    expect(await createStorageGuard({ persisted: async () => false, persist: async () => false }).persist()).toBe(false);
  });

  it('counts as not kept when the browser cannot promise, or fails', async () => {
    expect(await createStorageGuard(undefined).persist()).toBe(false);
    expect(await createStorageGuard({}).persist()).toBe(false);
    expect(await createStorageGuard({ persist: async () => Promise.reject(new Error('blocked')) }).persist()).toBe(false);
  });
});

describe('bills only on this phone (M2-7)', () => {
  it('counts waiting bills only, not catalog changes, and finds the oldest', async () => {
    const first = new Date(Date.now() - 6 * HOUR);
    await billAt(first);
    await billAt(new Date(Date.now() - HOUR));
    const unsynced = await unsyncedBills(db);
    expect(unsynced).toEqual({ count: 2, oldest: first.toISOString() });
    expect(await db.outbox.count()).toBeGreaterThan(2);
  });

  it('is old from 4 hours on', () => {
    const now = Date.now();
    const at = (ms: number) => ({ count: 1, oldest: new Date(now - ms).toISOString() });
    expect(isOld(at(OLD_UNSYNCED_MS - 1000), now)).toBe(false);
    expect(isOld(at(OLD_UNSYNCED_MS), now)).toBe(true);
    expect(isOld({ count: 0, oldest: null }, now)).toBe(false);
  });
});

describe('warnings on the home screen (M2-7)', () => {
  function renderHome(kept: boolean) {
    render(
      <App
        services={{
          db,
          storage: { persist: async () => kept },
          device: fakeDevice({ id: APPROVED_ID, status: 'approved', code: 'A' }),
          deviceAdmin: fakeDeviceAdmin(),
          staffDirectory: { cached: () => [ramesh], refresh: async () => [ramesh] },
        }}
      />,
    );
  }

  it('says so when the phone will not keep the data for sure', async () => {
    renderHome(false);
    expect((await screen.findByTestId('storage-not-kept')).textContent).toContain(hi.storageNotKept);
  });

  it('shows nothing when the data is kept and no bill is waiting long', async () => {
    await billAt(new Date(Date.now() - HOUR));
    renderHome(true);
    await screen.findByText(hi.staffChoose);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('storage-not-kept')).toBeNull();
    expect(screen.queryByTestId('unsynced-old')).toBeNull();
  });

  it('warns, before anyone unlocks, when bills have waited on this phone for 4 hours or more', async () => {
    await billAt(new Date(Date.now() - 5 * HOUR));
    await billAt(new Date(Date.now() - HOUR));
    renderHome(true);
    const warning = await screen.findByTestId('unsynced-old');
    expect(warning.textContent).toContain(`2 ${hi.billsOnlyOnPhone}`);
    expect(warning.textContent).toContain('5');
    expect(warning.textContent).toContain(hi.unsyncedHelp);
    expect(screen.getByText(hi.staffChoose)).toBeTruthy();
  });

  it('the warning goes away once those bills leave the phone', async () => {
    await billAt(new Date(Date.now() - 5 * HOUR));
    renderHome(true);
    await screen.findByTestId('unsynced-old');
    // What sync (M3) will do once the cloud confirms.
    await db.outbox.where('table').equals('bills').delete();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('unsynced-old')).toBeNull();
  });
});
