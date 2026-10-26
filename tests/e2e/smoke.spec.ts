import { expect, test } from '@playwright/test';
import { t } from '../../src/i18n';

test('shows the Hindi ready text', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(t.appReady)).toBeVisible();
});
