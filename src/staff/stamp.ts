import type { StaffMember } from './types';

/** Fields every record gets on the phone: its own UUID, the phone, the person and the time. */
export interface RecordStamp {
  id: string;
  device_id: string;
  staff_id: string;
  created_at: string;
}

export function stampRecord(staff: StaffMember | null, deviceId: string | null, now = new Date()): RecordStamp {
  if (!staff) throw new Error('no staff member is unlocked');
  if (!deviceId) throw new Error('this phone is not registered');
  return { id: crypto.randomUUID(), device_id: deviceId, staff_id: staff.id, created_at: now.toISOString() };
}
