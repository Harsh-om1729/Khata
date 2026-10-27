import { vi } from 'vitest';
import type { DeviceAdmin, DeviceRow } from '../../src/auth';
import type { DeviceInfo, DeviceRegistration } from '../../src/sync/device-registration';

export interface FakeDevice extends DeviceRegistration {
  refresh: ReturnType<typeof vi.fn<() => Promise<DeviceInfo>>>;
  /** Answer for the refresh after the ones already queued. */
  next(result: DeviceInfo | Error): FakeDevice;
}

export function fakeDevice(result: DeviceInfo | Error, cached: DeviceInfo | null = null): FakeDevice {
  const queue: (DeviceInfo | Error)[] = [result];
  const fake: FakeDevice = {
    cached: vi.fn(() => cached),
    refresh: vi.fn(async () => {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next instanceof Error || next === undefined) throw next ?? new Error('no result');
      return next;
    }),
    next(next) {
      queue.push(next);
      return fake;
    },
  };
  return fake;
}

export function fakeDeviceAdmin(initial: DeviceRow[] = []) {
  let rows = initial.map((r) => ({ ...r }));
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return {
    rows: () => rows,
    list: vi.fn(async () => rows.map((r) => ({ ...r }))),
    approve: vi.fn(async (id: string) => {
      const used = new Set(rows.flatMap((r) => (r.code ? [r.code] : [])));
      rows = rows.map((r) =>
        r.id === id ? { ...r, status: 'approved' as const, code: r.code ?? [...letters].find((l) => !used.has(l)) ?? null } : r,
      );
    }),
    revoke: vi.fn(async (id: string) => {
      rows = rows.map((r) => (r.id === id ? { ...r, status: 'revoked' as const } : r));
    }),
    rename: vi.fn(async (id: string, name: string) => {
      rows = rows.map((r) => (r.id === id ? { ...r, name } : r));
    }),
  } satisfies DeviceAdmin & { rows(): DeviceRow[] };
}

export const PENDING_ID = '3f9a2c11-0000-4000-8000-000000000001';
export const APPROVED_ID = 'b7d40e22-0000-4000-8000-000000000002';

export function deviceRow(
  id: string,
  status: DeviceRow['status'],
  code: string | null = null,
  extra: Partial<DeviceRow> = {},
): DeviceRow {
  return { id, name: id.slice(0, 6), status, code, last_seen: null, created_at: new Date().toISOString(), ...extra };
}
