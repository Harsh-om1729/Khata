import { describe, expect, it } from 'vitest';
import { stampRecord } from '../../src/staff/stamp';
import type { StaffMember } from '../../src/staff/types';

const ramesh: StaffMember = { id: 'staff-ramesh', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };

describe('record stamp (M0-7 done check)', () => {
  it('attaches the active staff ID, the phone and a fresh UUID to a test record', () => {
    const record = { amount_paise: 42_000, ...stampRecord(ramesh, 'device-1', new Date('2026-10-27T05:00:00Z')) };
    expect(record).toMatchObject({ staff_id: 'staff-ramesh', device_id: 'device-1', created_at: '2026-10-27T05:00:00.000Z' });
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(stampRecord(ramesh, 'device-1').id).not.toBe(record.id);
  });

  it('refuses to stamp a record when no staff member is unlocked', () => {
    expect(() => stampRecord(null, 'device-1')).toThrow();
  });
});
