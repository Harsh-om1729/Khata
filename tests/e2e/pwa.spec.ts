import { expect, test } from './fixtures';
import { hi as t } from '../../src/i18n';

interface ManifestIcon {
  src: string;
  sizes: string;
  purpose?: string;
}

interface Manifest {
  name: string;
  lang: string;
  display: string;
  icons: ManifestIcon[];
}

test('manifest is installable and its icons load', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as Manifest;

  expect(manifest.name).toBe(t.appName);
  expect(manifest.lang).toBe('hi');
  expect(manifest.display).toBe('standalone');

  const sizes = manifest.icons.map((icon) => icon.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);

  for (const icon of manifest.icons) {
    const iconRes = await request.get(`/${icon.src}`);
    expect(iconRes.status(), icon.src).toBe(200);
  }
});

test('opens offline after the first load', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText(t.appReady)).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first load is not controlled by the worker; reload once so it is.
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(t.appReady)).toBeVisible();
});
