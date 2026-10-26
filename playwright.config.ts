import { defineConfig, devices } from '@playwright/test';

// BASE_URL runs the same tests against a deployed site instead of a local build.
const liveUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { ...devices['Pixel 5'], baseURL: liveUrl ?? 'http://localhost:4174' },
  webServer: liveUrl
    ? undefined
    : {
        // Own folder and port, so an e2e build never replaces the real dist/ or a preview you are using.
        command: 'vite build --outDir dist-e2e --emptyOutDir && vite preview --outDir dist-e2e --port 4174 --strictPort',
        url: 'http://localhost:4174',
        reuseExistingServer: false,
        // A placeholder backend; owner-login.spec.ts fakes its API with page.route.
        env: { VITE_SUPABASE_URL: 'http://supabase.e2e.test', VITE_SUPABASE_ANON_KEY: 'e2e-placeholder-key' },
      },
});
