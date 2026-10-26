import { expect, test } from '@playwright/test';
import { hi as t } from '../../src/i18n';

test('shows the Hindi ready text', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(t.appReady)).toBeVisible();
});
