import type { SupabaseClient } from '@supabase/supabase-js';
import { registrationCode } from './device-code';
import { getDeviceClient } from './supabase-client';

export type DeviceStatus = 'pending' | 'approved' | 'revoked';

export interface DeviceInfo {
  id: string;
  status: DeviceStatus;
  /** Bill-number letter, set by the owner on approval. */
  code: string | null;
}

export interface DeviceRegistration {
  /** Last status seen from the server, saved on this phone. Works offline. */
  cached(): DeviceInfo | null;
  /** Registers this phone if needed, then fetches its status. Rejects when offline. */
  refresh(): Promise<DeviceInfo>;
}

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const CACHE_KEY = 'khata.device';

export const browserStore: KeyValueStore = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage blocked: the status is fetched again next time.
    }
  },
};

function isDeviceInfo(value: unknown): value is DeviceInfo {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    (v.status === 'pending' || v.status === 'approved' || v.status === 'revoked') &&
    (typeof v.code === 'string' || v.code === null)
  );
}

export function createDeviceRegistration(
  load: () => Promise<SupabaseClient> = getDeviceClient,
  store: KeyValueStore = browserStore,
): DeviceRegistration {
  const cached = (): DeviceInfo | null => {
    const raw = store.get(CACHE_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isDeviceInfo(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const fetchOwnRow = async (supabase: SupabaseClient): Promise<DeviceInfo | null> => {
    // Row-level security returns only this phone's own row.
    const { data, error } = await supabase.from('devices').select('id, status, code').limit(1);
    if (error) throw error;
    const row: unknown = data[0];
    return isDeviceInfo(row) ? row : null;
  };

  return {
    cached,

    async refresh() {
      const supabase = await load();
      const { data: session } = await supabase.auth.getSession();
      let userId = session.session?.user.id;
      if (!userId) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        userId = data.user?.id;
        if (!userId) throw new Error('anonymous sign-in returned no user');
      }

      let info = await fetchOwnRow(supabase);
      if (!info) {
        const id = crypto.randomUUID();
        const { error } = await supabase.from('devices').insert({
          id,
          auth_user_id: userId,
          name: registrationCode(id),
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
        info = { id, status: 'pending', code: null };
      }
      store.set(CACHE_KEY, JSON.stringify(info));
      return info;
    },
  };
}
