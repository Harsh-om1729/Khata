import { expect, test, type Page } from './fixtures';
import { hi } from '../../src/i18n';

// Every M2 function, used the way the shop will use it, in one run. Prices come from
// tests/fixtures/products-500.xlsx: Ultratech cement 50kg ₹380, 25kg ₹760.50; ACC 50kg ₹383.

test.use({ video: 'on' });

function fakeJwt(sub: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}
const staff = [
  { id: '11111111-2222-4333-8444-555555555555', name: 'Harsh', photo: null, is_owner: true, active: true, pin_version: 1, removed_at: null },
  { id: '22222222-2222-4333-8444-555555555555', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null },
];

async function fakeBackend(page: Page) {
  await page.route('**/auth/v1/signup', (route) =>
    route.fulfill({
      json: {
        access_token: fakeJwt('phone'), token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id: 'phone', aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      },
    }),
  );
  await page.route('**/rest/v1/devices**', (route) =>
    route.fulfill({ json: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', status: 'approved', code: 'A' }] }),
  );
  await page.route('**/rest/v1/staff**', (route) => route.fulfill({ json: staff }));
  await page.route('**/rest/v1/rpc/verify_staff_pin', (route) => route.fulfill({ json: 1 }));
}

async function unlock(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(name) }).click();
  for (const digit of '2468') await page.getByRole('button', { name: digit, exact: true }).click();
  await expect(page.getByRole('button', { name: hi.lockNow })).toBeVisible();
}

test('M2 acceptance: every billing function, start to finish', async ({ page }) => {
  test.setTimeout(180_000);
  await fakeBackend(page);
  const total = page.getByTestId('bill-total');
  const tile = (text: string) => page.getByTestId('item-tile').filter({ hasText: text });
  const tap = (text: string) => tile(text).getByRole('button').first().click();
  const line = (text: string) => page.getByTestId('bill-line').filter({ hasText: text });

  await test.step('setup: owner imports the 500-item Excel sample', async () => {
    await page.goto('/');
    await expect(page.getByText(hi.deviceApproved)).toBeVisible();
    await unlock(page, 'Harsh');
    await page.getByRole('button', { name: hi.manageItems }).click();
    await page.getByRole('button', { name: hi.excelTitle }).click();
    await page.getByLabel(hi.chooseExcel).setInputFiles('tests/fixtures/products-500.xlsx');
    await page.getByRole('button', { name: `${hi.confirmImport} (500)` }).click();
    await expect(page.getByText(hi.importDone)).toBeVisible();
    await page.getByRole('button', { name: hi.lockNow }).click();
    await unlock(page, 'Ramesh');
  });

  await test.step('M2-2: tap tiles, "On bill" badge, running total, search, remove last', async () => {
    await page.getByRole('button', { name: /Ultratech/ }).click();
    await tap('50kg');
    await tap('50kg');
    await tap('25kg');
    await expect(tile('50kg')).toContainText(`${hi.onBill} 2`);
    await expect(page.getByTestId('bill-count')).toHaveText(`2 ${hi.billItems}`);
    await expect(total).toHaveText('₹1,520.50');

    await page.getByPlaceholder(hi.search).fill('cement 50');
    await expect(page.getByTestId('item-tile')).toHaveCount(5);
    await tap('ACC');
    await expect(total).toHaveText('₹1,903.50');
    await page.getByRole('button', { name: hi.clearSearch }).click();

    await page.getByRole('button', { name: hi.undo }).click();
    await expect(total).toHaveText('₹1,520.50');
    await page.getByRole('button', { name: hi.undo }).click();
    await expect(total).toHaveText('₹760');
    await tap('25kg');
    await expect(total).toHaveText('₹1,520.50');
  });

  await test.step('M2-3: + / −, typed quantity, price for this bill, new default, remove and undo', async () => {
    await page.getByRole('button', { name: hi.seeBill }).click();
    await line('50kg').getByRole('button', { name: hi.moreOne }).click();
    await expect(total).toHaveText('₹1,900.50');
    await line('50kg').getByRole('button', { name: hi.lessOne }).click();
    await expect(line('50kg').getByTestId('line-qty')).toHaveText(`2 ${hi.unitBag}`);
    await expect(line('25kg').getByRole('button', { name: hi.lessOne })).toBeDisabled();

    await line('25kg').getByRole('button', { name: hi.typeQty }).click();
    await page.getByLabel(new RegExp(hi.typeQty)).fill('abc');
    await page.getByRole('button', { name: hi.ok }).click();
    await expect(page.getByText(hi.errorQty)).toBeVisible();
    await page.getByLabel(new RegExp(hi.typeQty)).fill('2.5');
    await page.getByRole('button', { name: hi.ok }).click();
    await expect(line('25kg').getByTestId('line-sum')).toHaveText('₹760.50 × 2.5 = ₹1,901.25');

    await line('50kg').getByRole('button', { name: hi.changeLinePrice }).click();
    await page.getByLabel(hi.linePrice).fill('370');
    await page.getByRole('button', { name: hi.ok }).click();
    await expect(line('50kg').getByTestId('price-changed')).toContainText('₹380');
    await expect(total).toHaveText('₹2,641.25');
    await line('50kg').getByRole('button', { name: hi.makeDefault }).click();
    await expect(line('50kg').getByText(hi.defaultSaved)).toBeVisible();
    await expect(line('50kg').getByTestId('price-changed')).toHaveCount(0);

    await line('25kg').getByRole('button', { name: hi.removeLine }).click();
    await expect(total).toHaveText('₹740');
    await page.getByRole('button', { name: hi.undo }).click();
    await expect(total).toHaveText('₹2,641.25');
  });

  await test.step('M2-6: "Not in list? Add new" with a new company goes on the bill, marked "new, check"', async () => {
    await page.getByPlaceholder(hi.search).fill('पेंट ब्रश');
    await expect(page.getByText(hi.searchNone)).toBeVisible();
    await page.getByRole('button', { name: hi.notInList }).click();
    await expect(page.getByLabel(hi.itemNameHi)).toHaveValue('पेंट ब्रश');
    await page.getByLabel(hi.companyName).selectOption('__new__');
    await page.getByLabel(hi.newCompanyName).fill('Local Paint');
    await page.getByLabel(hi.itemSize).fill('2 inch');
    await page.getByLabel(hi.itemPrice).fill('45');
    await page.getByRole('button', { name: hi.save }).click();
    await expect(total).toHaveText('₹2,686.25');
    await page.getByPlaceholder(hi.search).fill('पेंट ब्रश');
    await expect(tile('पेंट ब्रश')).toContainText(hi.needsReview);
    await expect(tile('पेंट ब्रश')).toContainText(`${hi.onBill} 1`);
    await page.getByRole('button', { name: hi.clearSearch }).click();
  });

  await test.step('M2-5 + M2-4: pay screen, double tap saves once, lock, "saved on this phone", bill number', async () => {
    // "Not in list" came back to the bill itself, so "See bill" is not shown here.
    await expect(page.getByRole('heading', { name: hi.bill, exact: true })).toBeVisible();
    await page.getByRole('button', { name: hi.takePayment }).click();
    await expect(page.getByTestId('pay-total')).toHaveText('₹2,686.25');
    await expect(page.getByLabel(hi.payCash)).toBeChecked();
    await page.getByRole('button', { name: hi.saveBill }).dblclick();
    const notice = page.getByTestId('saved-notice');
    await expect(notice).toContainText(hi.billSavedOnPhone);
    await expect(notice).toContainText(/A-\d{6}-001/);
    await expect(notice).toContainText('₹2,686.25');
    await expect(page.getByText(hi.staffChoose)).toBeVisible();
  });

  await test.step('M2-8: "Show bill" without a PIN', async () => {
    await page.getByRole('button', { name: hi.showBill }).click();
    const receipt = page.getByTestId('receipt');
    await expect(receipt.getByTestId('receipt-line')).toHaveText([
      'सीमेंट 50kg2 × ₹370 = ₹740',
      'सीमेंट 25kg2.5 × ₹760.50 = ₹1,901.25',
      'पेंट ब्रश 2 inch1 × ₹45 = ₹45',
    ]);
    await expect(receipt.getByTestId('receipt-total')).toHaveText('₹2,686.25');
    await expect(receipt).toContainText('Ramesh');
    await expect(receipt).toContainText(`${hi.payCash}: ₹2,686.25`);
    await page.getByRole('button', { name: hi.close }).click();
    await expect(page.getByText(hi.staffChoose)).toBeVisible();
  });

  await test.step('M2-4: the next bill gets the next number', async () => {
    await unlock(page, 'Ramesh');
    await page.getByRole('button', { name: /Ultratech/ }).click();
    await tap('25kg');
    await page.getByRole('button', { name: hi.seeBill }).click();
    await page.getByRole('button', { name: hi.takePayment }).click();
    await page.getByRole('button', { name: hi.saveBill }).click();
    await expect(page.getByTestId('saved-notice')).toContainText(/A-\d{6}-002/);
  });

  await test.step('M2-8: old bills, newest first; open one', async () => {
    await unlock(page, 'Ramesh');
    await page.getByRole('button', { name: hi.billHistory }).click();
    const rows = page.getByTestId('history-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText(/A-\d{6}-002/);
    await rows.nth(1).click();
    await expect(page.getByTestId('receipt-total')).toHaveText('₹2,686.25');
    await page.getByRole('button', { name: hi.close }).click();
    await page.getByRole('button', { name: hi.back }).click();
  });

  await test.step('M2-3: the new default price is saved and logged with who changed it', async () => {
    await page.getByRole('button', { name: hi.manageItems }).click();
    await page.getByRole('button', { name: /Ultratech/ }).click();
    await tap('50kg');
    await expect(page.getByTestId('current-price')).toContainText('₹370');
    await expect(page.getByTestId('price-change').first()).toContainText('₹380 → ₹370');
    await expect(page.getByTestId('price-change').first()).toContainText('Ramesh');
    await page.getByRole('button', { name: hi.lockNow }).click();
  });

  await test.step('airplane mode: bill made offline survives closing the app', async () => {
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await page.context().setOffline(true);
    await page.reload();
    await unlock(page, 'Ramesh');
    await page.getByRole('button', { name: /ACC/ }).click();
    await tap('50kg');
    await page.getByRole('button', { name: hi.seeBill }).click();
    await page.getByRole('button', { name: hi.takePayment }).click();
    await page.getByRole('button', { name: hi.saveBill }).click();
    await expect(page.getByTestId('saved-notice')).toContainText(/A-\d{6}-003/);

    await page.reload();
    await unlock(page, 'Ramesh');
    await page.getByRole('button', { name: hi.billHistory }).click();
    await expect(page.getByTestId('history-row')).toHaveCount(3);
    await expect(page.getByTestId('history-row').first()).toContainText('₹383');
  });

  await test.step('M2-7: storage warning, and the "only on this phone" warning after 4 hours', async () => {
    await expect(page.getByTestId('storage-not-kept')).toBeVisible();
    await expect(page.getByTestId('unsynced-old')).toHaveCount(0);
    await page.clock.install({ time: new Date(Date.now() + 5 * 60 * 60 * 1000) });
    await page.reload();
    await expect(page.getByTestId('unsynced-old')).toContainText(`3 ${hi.billsOnlyOnPhone}`);
  });
});
