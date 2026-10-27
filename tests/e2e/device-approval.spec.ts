import { expect, test, type Page } from './fixtures';
import { hi } from '../../src/i18n';

// Fakes the Supabase API of the e2e build so a brand-new phone can be walked through approval.
function fakeJwt(sub: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, role: 'authenticated', exp })}.sig`;
}

async function fakeBackend(page: Page) {
  const state: { row: { id: string; status: string; code: string | null } | null } = { row: null };

  await page.route('**/auth/v1/signup', (route) =>
    route.fulfill({
      json: {
        access_token: fakeJwt('phone-user'), token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh',
        user: {
          id: 'phone-user', aud: 'authenticated', role: 'authenticated', is_anonymous: true,
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      },
    }),
  );
  await page.route('**/rest/v1/devices**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { id: string };
      state.row = { id: body.id, status: 'pending', code: null };
      await route.fulfill({ status: 201, body: '' });
      return;
    }
    await route.fulfill({ json: state.row ? [state.row] : [] });
  });
  return state;
}

test('a new phone shows a code, then shows approved after the owner approves it', async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto('/');

  await expect(page.getByText(hi.devicePending)).toBeVisible();
  const id = backend.row?.id ?? '';
  const code = `${id.replace(/-/g, '').slice(0, 3)} ${id.replace(/-/g, '').slice(3, 6)}`.toUpperCase();
  await expect(page.getByText(code)).toBeVisible();

  // The owner approves it on their phone; this phone notices on "Check again".
  if (backend.row) backend.row = { ...backend.row, status: 'approved', code: 'A' };
  await page.getByRole('button', { name: hi.checkAgain }).click();
  await expect(page.getByText(`${hi.deviceApproved} (A)`)).toBeVisible();

  // After a restart offline, it still shows the last known status. The service worker only
  // serves the page once it controls it, which needs one online reload after installing.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByText(`${hi.deviceApproved} (A)`)).toBeVisible();
});
