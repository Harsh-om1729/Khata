import type { SupabaseClient } from '@supabase/supabase-js';

// The phone's own anonymous login lives under its own storage key, so the owner signing in
// by email on a staff phone never replaces that phone's device identity.
const DEVICE_STORAGE_KEY = 'khata-device';

let ownerClient: Promise<SupabaseClient> | null = null;
let deviceClient: Promise<SupabaseClient> | null = null;

// Both load on first use, after the first screen has rendered, so start-up stays small.
export function getSupabase(): Promise<SupabaseClient> {
  ownerClient ??= load().catch((error: unknown) => {
    ownerClient = null;
    throw error;
  });
  return ownerClient;
}

export function getDeviceClient(): Promise<SupabaseClient> {
  deviceClient ??= load(DEVICE_STORAGE_KEY).catch((error: unknown) => {
    deviceClient = null;
    throw error;
  });
  return deviceClient;
}

async function load(storageKey?: string): Promise<SupabaseClient> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set at build time');
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, storageKey ? { auth: { storageKey } } : undefined);
}
