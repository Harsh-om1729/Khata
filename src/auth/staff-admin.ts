import type { SupabaseClient } from '@supabase/supabase-js';
import type { StaffMember } from '../staff/types';
import { getSupabase } from '../sync/supabase-client';

export interface NewStaff {
  name: string;
  pin: string;
  isOwner: boolean;
}

export interface StaffAdmin {
  list(): Promise<StaffMember[]>;
  add(staff: NewStaff): Promise<void>;
  resetPin(staffId: string, pin: string): Promise<void>;
  remove(staffId: string): Promise<void>;
}

// Runs with the owner's email login; the server functions refuse anyone else (M0-6b).
export function createStaffAdmin(load: () => Promise<SupabaseClient> = getSupabase): StaffAdmin {
  const call = async (fn: string, args: Record<string, unknown>) => {
    const supabase = await load();
    const { error } = await supabase.rpc(fn, args);
    if (error) throw error;
  };

  return {
    async list() {
      const supabase = await load();
      const { data, error } = await supabase
        .from('staff')
        .select('id, name, photo, is_owner, active, pin_version, removed_at')
        .is('removed_at', null)
        .order('created_at');
      if (error) throw error;
      return data as StaffMember[];
    },
    add: ({ name, pin, isOwner }) =>
      call('add_staff', { p_id: crypto.randomUUID(), p_name: name.trim(), p_pin: pin, p_is_owner: isOwner }),
    resetPin: (staffId, pin) => call('reset_staff_pin', { p_id: staffId, p_new_pin: pin }),
    remove: (staffId) => call('remove_staff', { p_id: staffId }),
  };
}
