import type { SupabaseClient } from '@supabase/supabase-js';

let client: Promise<SupabaseClient> | null = null;

// Loaded on first use, so staff screens never download the Supabase library at start-up.
export function getSupabase(): Promise<SupabaseClient> {
  client ??= load().catch((error: unknown) => {
    client = null;
    throw error;
  });
  return client;
}

async function load(): Promise<SupabaseClient> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set at build time');
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key);
}
