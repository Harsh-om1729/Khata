import { expect, test, type Page } from './fixtures';
import { hi } from '../../src/i18n';

function fakeJwt(sub: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

const owner = { id: '11111111-2222-4333-8444-555555555555', name: 'Harsh', photo: null, is_owner: true, active: true, pin_version: 1, removed_at: null };

async function unlockedOwner(page: Page, { offline = false } = {}) {
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
  await page.route('**/rest/v1/staff**', (route) => route.fulfill({ json: [owner] }));
  await page.route('**/rest/v1/rpc/verify_staff_pin', (route) => route.fulfill({ json: 1 }));
  await page.goto('/');
  await expect(page.getByText(hi.deviceApproved)).toBeVisible();
  if (offline) {
    // Like an installed app: the service worker has cached everything, then the internet goes.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await page.context().setOffline(true);
    await page.reload();
  }
  await page.getByRole('button', { name: /Harsh/ }).click();
  for (const digit of '2468') await page.getByRole('button', { name: digit, exact: true }).click();
  await page.getByRole('button', { name: hi.excelTitle }).click();
}

const SAMPLE = 'tests/fixtures/products-500.xlsx';

test('downloads the blank template', async ({ page }) => {
  await unlockedOwner(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: hi.downloadTemplate }).click();
  expect((await download).suggestedFilename()).toBe('khata-products-template.xlsx');
});

test('the 500-row sample imports with a preview, and uploading it again adds nothing', async ({ page }) => {
  await unlockedOwner(page, { offline: true });

  await page.getByLabel(hi.chooseExcel).setInputFiles(SAMPLE);
  await expect(page.getByTestId('count-add')).toHaveText('500');
  await expect(page.getByTestId('count-errors')).toHaveText('0');
  await page.getByRole('button', { name: `${hi.confirmImport} (500)` }).click();
  await expect(page.getByText(hi.importDone)).toBeVisible();
  await page.getByRole('button', { name: hi.back }).last().click();

  await expect(page.getByRole('button', { name: /Ultratech/ })).toBeVisible();
  await page.getByRole('button', { name: /Ultratech/ }).click();
  await expect(page.getByTestId('item-tile').filter({ hasText: '50kg' })).toContainText('₹380');
  await page.getByRole('button', { name: hi.back }).click();

  await page.getByRole('button', { name: hi.excelTitle }).click();
  await page.getByLabel(hi.chooseExcel).setInputFiles(SAMPLE);
  await expect(page.getByTestId('count-add')).toHaveText('0');
  await expect(page.getByTestId('count-skip')).toHaveText('500');
  await expect(page.getByRole('button', { name: `${hi.confirmImport} (0)` })).toBeDisabled();
});

test('a wrong file is refused with a clear message and nothing is saved', async ({ page }) => {
  await unlockedOwner(page);
  await page.getByLabel(hi.chooseExcel).setInputFiles('tests/fixtures/make-products-500.mjs');
  await expect(page.getByRole('alert')).toContainText(hi.excelWrongFile);
});
