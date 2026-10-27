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
