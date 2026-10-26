import { readJson, type KeyValueStore } from './store';
import type { StaffMember } from './types';

// PBKDF2 slows down guessing if the phone's storage is copied. A 4-digit PIN can never be
// strong; this keeps offline unlock usable on a cheap phone (well under a second).
const ITERATIONS = 100_000;
const KEY = 'khata.pins';

interface Entry {
  salt: string;
  hash: string;
  pinVersion: number;
}

type Entries = Record<string, Entry>;

export interface PinVault {
  /** True when this phone can check this staff member's current PIN offline. */
  has(staffId: string, pinVersion: number): boolean;
  remember(staffId: string, pinVersion: number, pin: string): Promise<void>;
  matches(staffId: string, pin: string): Promise<boolean>;
  /** Drops offline unlock for staff whose PIN changed or who were removed. */
  forgetStale(members: StaffMember[]): void;
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return toBase64(new Uint8Array(bits));
}

function isEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.salt === 'string' && typeof v.hash === 'string' && typeof v.pinVersion === 'number';
}

export function createPinVault(store: KeyValueStore): PinVault {
  const read = (): Entries => {
    const raw = readJson(store, KEY);
    if (typeof raw !== 'object' || raw === null) return {};
    const entries: Entries = {};
    for (const [id, entry] of Object.entries(raw)) if (isEntry(entry)) entries[id] = entry;
    return entries;
  };
  const write = (entries: Entries) => store.set(KEY, JSON.stringify(entries));

  return {
    has(staffId, pinVersion) {
      return read()[staffId]?.pinVersion === pinVersion;
    },

    async remember(staffId, pinVersion, pin) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await derive(pin, salt);
      write({ ...read(), [staffId]: { salt: toBase64(salt), hash, pinVersion } });
    },

    async matches(staffId, pin) {
      const entry = read()[staffId];
      if (!entry) return false;
      return (await derive(pin, fromBase64(entry.salt))) === entry.hash;
    },

    forgetStale(members) {
      const byId = new Map(members.map((m) => [m.id, m]));
      const kept: Entries = {};
      for (const [id, entry] of Object.entries(read())) {
        const member = byId.get(id);
        if (member && member.active && member.removed_at === null && member.pin_version === entry.pinVersion) {
          kept[id] = entry;
        }
      }
      write(kept);
    },
  };
}
