import type { SupabaseClient } from '@supabase/supabase-js';
import { nextFreeCode } from '../sync/device-code';
import type { DeviceStatus } from '../sync/device-registration';
import { getSupabase } from '../sync/supabase-client';

export interface DeviceRow {
  id: string;
  name: string;
  status: DeviceStatus;
  code: string | null;
  last_seen: string | null;
  created_at: string;
}

export interface DeviceAdmin {
  list(): Promise<DeviceRow[]>;
  approve(deviceId: string): Promise<void>;
  revoke(deviceId: string): Promise<void>;
  rename(deviceId: string, name: string): Promise<void>;
}

const UNIQUE_VIOLATION = '23505';

// RLS turns a forbidden update into "0 rows changed" with no error, so check the count.
function expectOneRow(data: unknown[] | null): void {
  if (data?.length !== 1) throw new Error('device was not changed (owner login needed)');
}

// Runs with the owner's email login; RLS allows these reads and updates for the owner only.
export function createDeviceAdmin(load: () => Promise<SupabaseClient> = getSupabase): DeviceAdmin {
  const list = async (): Promise<DeviceRow[]> => {
    const supabase = await load();
    const { data, error } = await supabase
      .from('devices')
      .select('id, name, status, code, last_seen, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as DeviceRow[];
  };

  return {
    list,

    async approve(deviceId) {
      const supabase = await load();
      // Two owner screens could pick the same free letter; the unique rule catches it, so retry.
      for (let attempt = 0; attempt < 3; attempt++) {
        const devices = await list();
        const device = devices.find((d) => d.id === deviceId);
        if (!device) throw new Error('device not found');
        const used = devices.flatMap((d) => (d.code && d.id !== deviceId ? [d.code] : []));
        const code = device.code ?? nextFreeCode(used);
        const { data, error } = await supabase
          .from('devices')
          .update({ status: 'approved', code })
          .eq('id', deviceId)
          .select('id');
        if (!error) return expectOneRow(data);
        if (error.code !== UNIQUE_VIOLATION) throw error;
      }
      throw new Error('could not assign a device code');
    },

    async revoke(deviceId) {
      const supabase = await load();
      const { data, error } = await supabase
        .from('devices')
        .update({ status: 'revoked' })
        .eq('id', deviceId)
        .select('id');
      if (error) throw error;
      expectOneRow(data);
    },

    async rename(deviceId, name) {
      const supabase = await load();
      const { data, error } = await supabase
        .from('devices')
        .update({ name: name.trim() })
        .eq('id', deviceId)
        .select('id');
      if (error) throw error;
      expectOneRow(data);
    },
  };
}
