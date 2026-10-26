import { expect, test, type Page } from '@playwright/test';
import { hi } from '../../src/i18n';

// The e2e build points at a placeholder Supabase URL; these routes stand in for its API,
// so the real supabase-js and UI wiring run without Docker or the cloud project.
const OWNER = 'owner@shop.in';

function fakeJwt(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'owner-id', role: 'authenticated', exp })}.sig`;
}

async function fakeSupabase(page: Page, { password, isOwner }: { password: string; isOwner: boolean }) {
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    const body = route.request().postDataJSON() as { password: string };
    if (body.password !== password) {
      await route.fulfill({ status: 400, json: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } });
      return;
    }
    await route.fulfill({
      json: {
        access_token: fakeJwt(), token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh',
        user: {
          id: 'owner-id', aud: 'authenticated', role: 'authenticated', email: OWNER, is_anonymous: false,
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      },
    });
  });
  await page.route('**/rest/v1/rpc/is_owner', (route) => route.fulfill({ json: isOwner }));
  await page.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 204, body: '' }));
}

async function signIn(page: Page, password: string) {
  await page.goto('/');
  await page.getByRole('button', { name: hi.owner }).click();
  await page.getByLabel(hi.email).fill(OWNER);
  await page.getByLabel(hi.password).fill(password);
  await page.getByRole('button', { name: hi.signIn }).click();
}

test('owner signs in, stays signed in after reload, and signs out', async ({ page }) => {
  await fakeSupabase(page, { password: 'right-pass', isOwner: true });
  await signIn(page, 'right-pass');
  await expect(page.getByText(OWNER)).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: hi.owner }).click();
  await expect(page.getByText(OWNER)).toBeVisible();

  await page.getByRole('button', { name: hi.signOut }).click();
  await expect(page.getByText(hi.appReady)).toBeVisible();
  await page.getByRole('button', { name: hi.owner }).click();
  await expect(page.getByRole('heading', { name: hi.ownerLoginTitle })).toBeVisible();
});

test('wrong password shows a message', async ({ page }) => {
  await fakeSupabase(page, { password: 'right-pass', isOwner: true });
  await signIn(page, 'wrong-pass');
  await expect(page.getByRole('alert')).toContainText(hi.errorWrong);
});

test('a non-owner account is refused and not kept signed in', async ({ page }) => {
  await fakeSupabase(page, { password: 'right-pass', isOwner: false });
  await signIn(page, 'right-pass');
  await expect(page.getByRole('alert')).toContainText(hi.errorNotOwner);
  await page.getByRole('button', { name: hi.back }).click();
  await page.getByRole('button', { name: hi.owner }).click();
  await expect(page.getByRole('heading', { name: hi.ownerLoginTitle })).toBeVisible();
});
