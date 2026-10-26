import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

// Keys come from the running local stack at test time, so none are ever stored in the repo.
function localSupabaseEnv(): Record<string, string> {
  let out: string;
  try {
    out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error('Local Supabase is not running. Start Docker Desktop, then run: npm run db:start');
  }
  const vars = new Map<string, string>();
  for (const line of out.split('\n')) {
    const match = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
    if (match?.[1] && match[2] !== undefined) vars.set(match[1], match[2]);
  }
  const pick = (name: string): string => {
    const value = vars.get(name);
    if (!value) throw new Error(`supabase status did not report ${name}`);
    return value;
  };
  return {
    SUPABASE_URL: pick('API_URL'),
    SUPABASE_ANON_KEY: pick('ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: pick('SERVICE_ROLE_KEY'),
  };
}

export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    environment: 'node',
    env: localSupabaseEnv(),
    testTimeout: 20_000,
  },
});
