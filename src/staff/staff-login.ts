import type { PinLock } from './pin-lock';
import type { PinVault } from './pin-vault';
import type { StaffMember } from './types';

export type LoginResult =
  | { kind: 'ok' }
  | { kind: 'wrong' }
  | { kind: 'locked'; until: number }
  | { kind: 'needsInternet' };

export interface PinVerifier {
  /** The staff member's current pin_version, or 'wrong'. Rejects when the server can't be reached. */
  verify(staffId: string, pin: string): Promise<number | 'wrong'>;
}

export interface StaffLogin {
  login(member: StaffMember, pin: string): Promise<LoginResult>;
  lockedUntil(): number | null;
}

export function createStaffLogin(deps: {
  vault: PinVault;
  lock: PinLock;
  verifier: PinVerifier;
  now?: () => number;
}): StaffLogin {
  const now = deps.now ?? Date.now;
  const { vault, lock, verifier } = deps;

  return {
    lockedUntil: () => lock.lockedUntil(now()),

    async login(member, pin) {
      const until = lock.lockedUntil(now());
      if (until !== null) return { kind: 'locked', until };

      // Offline path: this phone has seen this staff member's current PIN before.
      if (vault.has(member.id, member.pin_version)) {
        if (await vault.matches(member.id, pin)) {
          lock.reset();
          return { kind: 'ok' };
        }
        lock.recordFailure(now());
        const lockedNow = lock.lockedUntil(now());
        return lockedNow !== null ? { kind: 'locked', until: lockedNow } : { kind: 'wrong' };
      }

      // First login on this phone (or after a PIN change): the server checks the PIN.
      let result: number | 'wrong';
      try {
        result = await verifier.verify(member.id, pin);
      } catch {
        return { kind: 'needsInternet' };
      }
      if (result === 'wrong') return { kind: 'wrong' };
      await vault.remember(member.id, result, pin);
      lock.reset();
      return { kind: 'ok' };
    },
  };
}
