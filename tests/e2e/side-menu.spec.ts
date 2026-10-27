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

test.use({ viewport: { width: 360, height: 740 } });

test('side menu at 360px: covers the screen, opens a row, and closes on the dimmed background', async ({ page }) => {
  await fakeBackend(page);
  await page.goto('/');
  await expect(page.getByText(hi.deviceApproved)).toBeVisible();
  await unlock(page);

  await page.getByRole('button', { name: hi.menu }).click();
  const menu = page.getByRole('dialog', { name: hi.menu });
  await expect(menu).toBeVisible();
  // The screen behind is inert, so only the menu's own buttons are reachable.
  const lockInert = () => page.getByRole('button', { name: hi.lockNow }).evaluate((el) => el.closest<HTMLElement>('[inert]')?.inert === true);
  expect(await lockInert()).toBe(true);

  await menu.getByRole('button', { name: hi.menuItems, exact: true }).click();
  await menu.getByRole('button', { name: hi.excelTitle }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: hi.downloadTemplate })).toBeVisible();

  await page.getByRole('button', { name: hi.menu }).click();
  await page.mouse.click(340, 400);
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: hi.lockNow })).toBeVisible();
  expect(await lockInert()).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
