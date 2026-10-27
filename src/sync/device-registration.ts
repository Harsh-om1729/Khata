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

/** The server answered but said no (e.g. anonymous sign-ins switched off); internet is fine. */
export class RegistrationRefusedError extends Error {
  constructor(cause: unknown) {
    super('the server refused to register this phone', { cause });
    this.name = 'RegistrationRefusedError';
  }
}

interface ServerErrorLike {
  name?: string;
  status?: number;
  code?: string;
}

// Auth errors carry an HTTP status (0 when the request never arrived); database errors carry a
// Postgres code (empty when the request never arrived). Anything else is treated as offline.
function asRegistrationError(error: ServerErrorLike): Error {
  const authRefused = typeof error.status === 'number' && error.status >= 400;
  const dbRefused = typeof error.code === 'string' && error.code !== '' && error.status === undefined;
  if (authRefused || dbRefused) return new RegistrationRefusedError(error);
  return error instanceof Error ? error : new Error('offline', { cause: error });
}

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
    if (error) throw asRegistrationError(error);
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
        if (error) throw asRegistrationError(error);
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
        if (error) throw asRegistrationError(error);
        info = { id, status: 'pending', code: null };
      }
      // "Last seen" for the owner's phone list; not worth failing registration over.
      await supabase.rpc('device_seen').then(() => {}, () => {});
      store.set(CACHE_KEY, JSON.stringify(info));
      return info;
    },
  };
}
