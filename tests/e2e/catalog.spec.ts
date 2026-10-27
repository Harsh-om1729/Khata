import { expect, test, type Page } from './fixtures';
import { hi } from '../../src/i18n';

function fakeJwt(sub: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

const ramesh = { id: '11111111-2222-4333-8444-555555555555', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };

// An approved phone with one staff member whose PIN is 2468.
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
  await page.route('**/rest/v1/staff**', (route) => route.fulfill({ json: [ramesh] }));
  await page.route('**/rest/v1/rpc/verify_staff_pin', (route) => route.fulfill({ json: 1 }));
}

async function unlock(page: Page) {
  await page.getByRole('button', { name: /Ramesh/ }).click();
  for (const digit of '2468') await page.getByRole('button', { name: digit, exact: true }).click();
}

test('add a company and an item in under 30 seconds, with no internet, and it is still there after reopening', async ({ page }) => {
  await fakeBackend(page);
  await page.goto('/');
  await expect(page.getByText(hi.deviceApproved)).toBeVisible();
  await unlock(page);
  await page.context().setOffline(true);

  const started = Date.now();
  await page.getByRole('button', { name: hi.addCompany }).click();
  await page.getByLabel(hi.companyName).fill('Ultratech');
  await page.getByRole('button', { name: hi.save }).click();
  await page.getByRole('button', { name: hi.addItem }).click();
  await page.getByLabel(hi.itemNameHi).fill('सीमेंट');
  await page.getByLabel(hi.itemSize).fill('50kg');
  await page.getByText(hi.unitBag, { exact: true }).click();
  await page.getByLabel(hi.itemPrice).fill('420');
  await page.getByRole('button', { name: hi.save }).click();
  await expect(page.getByTestId('item-tile')).toContainText('₹420');
  expect(Date.now() - started).toBeLessThan(30_000);

  await page.context().setOffline(false);
  await page.reload();
  await unlock(page);
  await page.getByRole('button', { name: /Ultratech/ }).click();
  await expect(page.getByTestId('item-tile')).toContainText('सीमेंट');
  await expect(page.getByTestId('item-tile')).toContainText('50kg');
});

test('a camera photo is shrunk on the phone and shows on the item tile; an item without one shows its letter', async ({ page }) => {
  await fakeBackend(page);
  await page.goto('/');
  await expect(page.getByText(hi.deviceApproved)).toBeVisible();
  await unlock(page);
  await page.context().setOffline(true);

  await page.getByRole('button', { name: hi.manageItems }).click();
  await page.getByRole('button', { name: hi.addCompany }).click();
  await page.getByLabel(hi.companyName).fill('Tata');
  await page.getByRole('button', { name: hi.save }).click();
  await page.getByRole('button', { name: hi.addItem }).click();
  await page.getByLabel(hi.itemNameEn).fill('Rod');
  await page.getByLabel(hi.itemPrice).fill('80');
  await page.getByRole('button', { name: hi.save }).click();
  await expect(page.getByTestId('item-tile')).toContainText('Rod');

  await page.getByRole('button', { name: hi.addItem }).click();
  await page.getByLabel(hi.itemNameEn).fill('Cement');
  await page.getByLabel(hi.itemPrice).fill('420');

  // Hands the camera input a camera-sized photo (4000×3000, over 1 MB), made in the browser.
  const originalSize = await page.getByLabel(hi.takePhoto).evaluate(async (input: HTMLInputElement) => {
    const canvas = new OffscreenCanvas(4000, 3000);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no canvas');
    const gradient = context.createLinearGradient(0, 0, 4000, 3000);
    gradient.addColorStop(0, '#884422');
    gradient.addColorStop(1, '#2266aa');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4000, 3000);
    for (let i = 0; i < 20000; i++) {
      context.fillStyle = `hsl(${i % 360} 60% ${30 + (i % 40)}%)`;
      context.fillRect((i * 7919) % 4000, (i * 104729) % 3000, 8 + (i % 40), 8 + (i % 30));
    }
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    const files = new DataTransfer();
    files.items.add(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
    input.files = files.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return blob.size;
  });
  expect(originalSize).toBeGreaterThan(1_000_000);
  await expect(page.getByAltText(hi.photoAdded)).toBeVisible();
  await page.getByRole('button', { name: hi.save }).click();

  const cement = page.getByTestId('item-tile').filter({ hasText: 'Cement' });
  const rod = page.getByTestId('item-tile').filter({ hasText: 'Rod' });
  const img = cement.locator('img.tile__photo');
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(480);
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalHeight)).toBe(360);
  await expect(rod.locator('img')).toHaveCount(0);
  await expect(rod.locator('.tile__avatar')).toHaveText('R');

  const stored = await img.evaluate(async (el: HTMLImageElement) => (await (await fetch(el.src)).blob()).size);
  expect(stored).toBeLessThan(150_000);
});

test('billing offline: tap items and search, and the bill strip shows the running total', async ({ page }) => {
  await fakeBackend(page);
  await page.goto('/');
  await expect(page.getByText(hi.deviceApproved)).toBeVisible();
  await unlock(page);
  await page.context().setOffline(true);

  await page.getByRole('button', { name: hi.addCompany }).click();
  await page.getByLabel(hi.companyName).fill('Ultratech');
  await page.getByRole('button', { name: hi.save }).click();
  const sizes: [string, string][] = [['50kg', '380'], ['25kg', '200']];
  for (const [size, price] of sizes) {
    await page.getByRole('button', { name: hi.addItem }).click();
    await page.getByLabel(hi.itemNameHi).fill('सीमेंट');
    await page.getByLabel(hi.itemSize).fill(size);
    await page.getByLabel(hi.itemPrice).fill(price);
    await page.getByRole('button', { name: hi.save }).click();
  }
  // Items added while billing go on the bill (M2-6); take them off to start this bill clean.
  await expect(page.getByTestId('bill-total')).toHaveText('₹580');
  await page.getByRole('button', { name: hi.undo }).click();
  await page.getByRole('button', { name: hi.undo }).click();
  await expect(page.getByTestId('bill-total')).toHaveText('₹0');

  const tile = (text: string) => page.getByTestId('item-tile').filter({ hasText: text }).getByRole('button').first();
  await tile('50kg').click();
  await tile('50kg').click();
  await expect(page.getByTestId('bill-total')).toHaveText('₹760');
  await expect(page.getByTestId('item-tile').filter({ hasText: '50kg' })).toContainText(`${hi.onBill} 2`);

  await page.getByPlaceholder(hi.search).fill('सीमेंट 25');
  await expect(page.getByTestId('item-tile')).toHaveCount(1);
  await tile('25kg').click();
  await expect(page.getByTestId('bill-total')).toHaveText('₹960');
  await expect(page.getByTestId('bill-count')).toHaveText(`2 ${hi.billItems}`);

  await page.getByRole('button', { name: hi.undo }).click();
  await expect(page.getByTestId('bill-total')).toHaveText('₹760');
  await expect(page.getByTestId('bill-total')).toBeInViewport();

  await page.getByRole('button', { name: hi.seeBill }).click();
  const line = page.getByTestId('bill-line');
  await line.getByRole('button', { name: hi.typeQty }).click();
  await page.getByLabel(hi.typeQty).fill('2.5');
  await page.getByRole('button', { name: hi.ok }).click();
  await line.getByRole('button', { name: hi.changeLinePrice }).click();
  await page.getByLabel(hi.linePrice).fill('370');
  await page.getByRole('button', { name: hi.ok }).click();
  await expect(line.getByTestId('line-sum')).toHaveText('₹370 × 2.5 = ₹925');
  await expect(page.getByTestId('bill-total')).toHaveText('₹925');
  await expect(line.getByTestId('price-changed')).toContainText('₹380');

  await page.getByRole('button', { name: hi.takePayment }).click();
  await page.getByRole('button', { name: hi.saveBill }).click();
  await page.getByRole('button', { name: hi.showBill }).click();
  await expect(page.getByTestId('receipt-total')).toHaveText('₹925');
  await expect(page.getByTestId('receipt-line')).toHaveText(['सीमेंट 50kg2.5 × ₹370 = ₹925']);
});

test('"Not in list? Add new" offline: a new company and item go straight on the bill', async ({ page }) => {
  await fakeBackend(page);
  await page.goto('/');
  await expect(page.getByText(hi.deviceApproved)).toBeVisible();
  await unlock(page);
  await page.context().setOffline(true);

  await page.getByPlaceholder(hi.search).fill('पेंट ब्रश');
  await expect(page.getByText(hi.searchNone)).toBeVisible();
  await page.getByRole('button', { name: hi.notInList }).click();
  await expect(page.getByLabel(hi.itemNameHi)).toHaveValue('पेंट ब्रश');
  await page.getByLabel(hi.companyName).selectOption('__new__');
  await page.getByLabel(hi.newCompanyName).fill('Asian Paints');
  await page.getByLabel(hi.itemSize).fill('2 inch');
  await page.getByLabel(hi.itemPrice).fill('45');
  await page.getByRole('button', { name: hi.save }).click();

  await expect(page.getByTestId('bill-total')).toHaveText('₹45');
  await page.getByRole('button', { name: /Asian Paints/ }).click();
  const tile = page.getByTestId('item-tile').filter({ hasText: '2 inch' });
  await expect(tile).toContainText(`${hi.onBill} 1`);
  await expect(tile).toContainText(hi.needsReview);
});
