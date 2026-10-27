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
  const calls = { verify: 0 };
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
  await page.route('**/rest/v1/rpc/verify_staff_pin', async (route) => {
    calls.verify++;
    const body = route.request().postDataJSON() as { p_pin: string };
    if (body.p_pin === '2468') await route.fulfill({ json: 1 });
    else await route.fulfill({ status: 403, json: { code: '28P01', message: 'wrong PIN' } });
  });
  return calls;
}

async function unlock(page: Page, pin: string) {
  await page.getByRole('button', { name: /Ramesh/ }).click();
  for (const digit of pin) await page.getByRole('button', { name: digit, exact: true }).click();
}

test('unlock online once, then unlock offline after closing the app', async ({ page }) => {
  const calls = await fakeBackend(page);
  await page.goto('/');

  await unlock(page, '0000');
  await expect(page.getByRole('alert')).toContainText(hi.pinWrong);
  await page.getByRole('button', { name: hi.back }).click();

  await unlock(page, '2468');
  await expect(page.getByText('Ramesh', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: hi.lockNow })).toBeVisible();
  expect(calls.verify).toBe(2);

  // Let the service worker take control, then restart the app with no internet.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await page.context().setOffline(true);
  await page.reload();

  // Closing the app locked it; the saved staff list and offline PIN still work.
  await expect(page.getByText(hi.staffChoose)).toBeVisible();
  await unlock(page, '2468');
  await expect(page.getByRole('button', { name: hi.lockNow })).toBeVisible();
  expect(calls.verify).toBe(2);
});
