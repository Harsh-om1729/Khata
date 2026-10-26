import { defineConfig, devices } from '@playwright/test';

// BASE_URL runs the same tests against a deployed site instead of a local build.
const liveUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { ...devices['Pixel 5'], baseURL: liveUrl ?? 'http://localhost:4173' },
  webServer: liveUrl
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: false,
      },
});
