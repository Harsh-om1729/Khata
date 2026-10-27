import { test as base } from '@playwright/test';

// Tests also run against the live site (npm run test:e2e:live). Without this, every test
// page would register itself as a new phone in the shop's real Supabase project. Block all
// real Supabase calls; a spec's own page.route fakes are added later, so they take priority.
export const test = base.extend<{ blockRealSupabase: void }>({
  blockRealSupabase: [
    async ({ page }, use) => {
      await page.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, (route) => route.abort());
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
