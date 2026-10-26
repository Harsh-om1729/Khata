import type { SupabaseClient } from '@supabase/supabase-js';
import { getDeviceClient } from '../sync/supabase-client';
import type { PinVerifier } from './staff-login';
import { readJson, type KeyValueStore } from './store';
import type { PinVault } from './pin-vault';
import type { StaffMember } from './types';

const WRONG_PIN = '28P01';
const STAFF_KEY = 'khata.staff';
const COLUMNS = 'id, name, photo, is_owner, active, pin_version, removed_at';

export function createPinVerifier(load: () => Promise<SupabaseClient> = getDeviceClient): PinVerifier {
  return {
    async verify(staffId, pin) {
      const supabase = await load();
      const { data, error } = await supabase.rpc('verify_staff_pin', { p_id: staffId, p_pin: pin });
      if (error) {
        if (error.code === WRONG_PIN) return 'wrong';
        throw error;
      }
      if (typeof data !== 'number') throw new Error('unexpected verify_staff_pin result');
      return data;
    },
  };
}

export interface StaffDirectory {
  /** Last staff list seen from the server, saved on this phone. Works offline. */
  cached(): StaffMember[];
  /** Fetches the list; forgets offline PINs that changed or whose staff were removed. */
  refresh(): Promise<StaffMember[]>;
}

function isMember(value: unknown): value is StaffMember {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.pin_version === 'number'
    && typeof v.active === 'boolean' && typeof v.is_owner === 'boolean'
    && (typeof v.removed_at === 'string' || v.removed_at === null)
    && (typeof v.photo === 'string' || v.photo === null);
}

export function createStaffDirectory(deps: {
  store: KeyValueStore;
  vault: PinVault;
  load?: () => Promise<SupabaseClient>;
}): StaffDirectory {
  const load = deps.load ?? getDeviceClient;
  const cached = (): StaffMember[] => {
    const raw = readJson(deps.store, STAFF_KEY);
    return Array.isArray(raw) ? raw.filter(isMember) : [];
  };
  return {
    cached,
    async refresh() {
      const supabase = await load();
      const { data, error } = await supabase.from('staff').select(COLUMNS).order('created_at');
      if (error) throw error;
      const members = (data as unknown[]).filter(isMember);
      deps.store.set(STAFF_KEY, JSON.stringify(members));
      deps.vault.forgetStale(members);
      return members;
    },
  };
}
