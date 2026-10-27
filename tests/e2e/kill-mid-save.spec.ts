import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { hi } from '../../src/i18n';

// DATA-SAFETY §4 test 1: kill the app mid-sale, nothing half-saved. Each round kills the whole
// browser at a different moment after Save, then reopens the same profile.

function fakeJwt(sub: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}
const ramesh = { id: '11111111-2222-4333-8444-555555555555', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };

async function openApp(profile: string, baseURL: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await chromium.launchPersistentContext(profile, { baseURL });
  await context.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, (route) => route.abort());
  await context.route('**/auth/v1/signup', (route) =>
    route.fulfill({
      json: {
        access_token: fakeJwt('phone'), token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id: 'phone', aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      },
    }),
  );
  await context.route('**/rest/v1/devices**', (route) =>
    route.fulfill({ json: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', status: 'approved', code: 'A' }] }),
  );
  await context.route('**/rest/v1/staff**', (route) => route.fulfill({ json: [ramesh] }));
  await context.route('**/rest/v1/rpc/verify_staff_pin', (route) => route.fulfill({ json: 1 }));
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('/');
  await expect(page.getByText(hi.deviceApproved)).toBeVisible();
  return { context, page };
}

async function unlock(page: Page) {
  await page.getByRole('button', { name: /Ramesh/ }).click();
  for (const digit of '2468') await page.getByRole('button', { name: digit, exact: true }).click();
}

interface Stores {
  bills: { id: string; bill_no: string; total_paise: number }[];
  bill_lines: { bill_id: string; line_total_paise: number }[];
  payments: { bill_id: string; amount_paise: number }[];
  outbox: { table: string; row?: { id: string } }[];
  bill_counters: { day: string; last: number }[];
}

function readStores(page: Page): Promise<Stores> {
  return page.evaluate(
    () =>
      new Promise<Stores>((resolve, reject) => {
        const open = indexedDB.open('khata');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const names = ['bills', 'bill_lines', 'payments', 'outbox', 'bill_counters'] as const;
          const tx = open.result.transaction([...names], 'readonly');
          const out: Record<string, unknown[]> = {};
          for (const name of names) {
            const request = tx.objectStore(name).getAll();
            request.onsuccess = () => (out[name] = request.result);
          }
          tx.oncomplete = () => resolve(out as unknown as Stores);
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

test('killing the app at any moment during Save never leaves half a bill', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const baseURL = String(testInfo.project.use.baseURL);
  const profile = testInfo.outputPath('profile');
  const delays = [0, 1, 3, 5, 10, 20, 40, 80, 300];

  for (const [round, delay] of delays.entries()) {
    const { context, page } = await openApp(profile, baseURL);
    await unlock(page);
    if (round === 0) {
      await page.getByRole('button', { name: hi.addCompany }).click();
      await page.getByLabel(hi.companyName).fill('Ultratech');
      await page.getByRole('button', { name: hi.save }).click();
      for (const [size, price] of [['50kg', '380'], ['25kg', '200']] as [string, string][]) {
        await page.getByRole('button', { name: hi.addItem }).click();
        await page.getByLabel(hi.itemNameHi).fill('सीमेंट');
        await page.getByLabel(hi.itemSize).fill(size);
        await page.getByLabel(hi.itemPrice).fill(price);
        await page.getByRole('button', { name: hi.save }).click();
      }
    } else {
      await page.getByRole('button', { name: /Ultratech/ }).click();
    }
    const tile = (text: string) => page.getByTestId('item-tile').filter({ hasText: text }).getByRole('button').first();
    await tile('50kg').click();
    await tile('25kg').click();
    await page.getByRole('button', { name: hi.seeBill }).click();
    await page.getByRole('button', { name: hi.takePayment }).click();
    await page.getByRole('button', { name: hi.saveBill }).click();
    if (delay > 0) await page.waitForTimeout(delay);
    await context.close();
  }

  const { context, page } = await openApp(profile, baseURL);
  const db = await readStores(page);
  await context.close();

  // The last round waited long enough to finish, so at least one bill exists.
  expect(db.bills.length).toBeGreaterThan(0);
  expect(new Set(db.bills.map((b) => b.bill_no)).size).toBe(db.bills.length);
  for (const bill of db.bills) {
    const lines = db.bill_lines.filter((l) => l.bill_id === bill.id);
    expect(lines).toHaveLength(2);
    expect(lines.reduce((sum, l) => sum + l.line_total_paise, 0)).toBe(bill.total_paise);
    expect(db.payments.filter((p) => p.bill_id === bill.id)).toEqual([expect.objectContaining({ amount_paise: bill.total_paise })]);
    expect(db.outbox.filter((e) => e.table === 'bills' && e.row?.id === bill.id)).toHaveLength(1);
  }
  expect(db.bill_lines.every((l) => db.bills.some((b) => b.id === l.bill_id))).toBe(true);
  expect(db.payments.every((p) => db.bills.some((b) => b.id === p.bill_id))).toBe(true);
  expect(db.outbox.filter((e) => e.table === 'bill_lines')).toHaveLength(db.bill_lines.length);
  expect(db.outbox.filter((e) => e.table === 'payments')).toHaveLength(db.payments.length);
  // A number is only used up by a bill that was kept.
  expect(db.bill_counters.reduce((sum, c) => sum + c.last, 0)).toBe(db.bills.length);
  testInfo.annotations.push({ type: 'bills kept', description: `${db.bills.length} of ${delays.length}` });
  console.log(`bills kept after kills: ${db.bills.length} of ${delays.length}`);
});
