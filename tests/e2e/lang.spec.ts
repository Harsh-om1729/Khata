import { expect, test } from './fixtures';
import { en, hi } from '../../src/i18n';

test('switches to English and stays English after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(hi.appReady)).toBeVisible();

  await page.getByRole('button', { name: hi.switchLangLabel }).click();
  await expect(page.getByText(en.appReady)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();
  await expect(page.getByText(en.appReady)).toBeVisible();
});
