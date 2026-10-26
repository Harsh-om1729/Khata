import { describe, expect, it, vi } from 'vitest';
import { createPinLock, LOCK_MS } from '../../src/staff/pin-lock';
import { createPinVault } from '../../src/staff/pin-vault';
import { createStaffLogin, type PinVerifier } from '../../src/staff/staff-login';
import { memoryStore } from '../../src/staff/store';
import type { StaffMember } from '../../src/staff/types';

const ramesh: StaffMember = { id: 'ramesh', name: 'Ramesh', photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null };
const sita: StaffMember = { ...ramesh, id: 'sita', name: 'Sita' };

/** A server that knows these PINs, and can be switched off to simulate no internet. */
function fakeServer(pins: Record<string, string>) {
  const state = { online: true };
  const verifier: PinVerifier = {
    verify: vi.fn(async (staffId: string, pin: string) => {
      if (!state.online) throw new Error('offline');
      return pins[staffId] === pin ? 1 : 'wrong';
    }),
  };
  return { state, verifier };
}

function setup(pins: Record<string, string> = { ramesh: '2468', sita: '1357' }) {
  const store = memoryStore();
  const server = fakeServer(pins);
  let clock = 1_000_000;
  const vault = createPinVault(store);
  const login = createStaffLogin({ vault, lock: createPinLock(store), verifier: server.verifier, now: () => clock });
  return { store, server, vault, login, advance: (ms: number) => (clock += ms) };
}

describe('staff PIN login (M0-7)', () => {
  it('offline unlock works after one online login', async () => {
    const { server, login } = setup();
    expect(await login.login(ramesh, '2468')).toEqual({ kind: 'ok' });

    server.state.online = false;
    expect(await login.login(ramesh, '2468')).toEqual({ kind: 'ok' });
    expect(server.verifier.verify).toHaveBeenCalledTimes(1);
  });

  it('a new staff member cannot unlock offline on a phone they never used online', async () => {
    const { server, login } = setup();
    await login.login(ramesh, '2468');
    server.state.online = false;
    expect(await login.login(sita, '1357')).toEqual({ kind: 'needsInternet' });
  });

  it('5 wrong offline tries lock the PIN screen for 5 minutes, even for the right PIN', async () => {
    const { server, login, advance } = setup();
    await login.login(ramesh, '2468');
    server.state.online = false;

    for (let i = 0; i < 4; i++) expect(await login.login(ramesh, '0000')).toEqual({ kind: 'wrong' });
    const fifth = await login.login(ramesh, '0000');
    expect(fifth.kind).toBe('locked');
    expect(await login.login(ramesh, '2468')).toMatchObject({ kind: 'locked' });

    advance(LOCK_MS - 1_000);
    expect((await login.login(ramesh, '2468')).kind).toBe('locked');
    advance(2_000);
    expect(await login.login(ramesh, '2468')).toEqual({ kind: 'ok' });
  });

  it('the lock survives an app restart', async () => {
    const { store, server, login } = setup();
    await login.login(ramesh, '2468');
    server.state.online = false;
    for (let i = 0; i < 5; i++) await login.login(ramesh, '0000');

    const restarted = createStaffLogin({
      vault: createPinVault(store), lock: createPinLock(store), verifier: server.verifier, now: () => 1_000_000,
    });
    expect((await restarted.login(ramesh, '2468')).kind).toBe('locked');
  });

  it('a right PIN resets the count of wrong tries', async () => {
    const { server, login } = setup();
    await login.login(ramesh, '2468');
    server.state.online = false;
    for (let i = 0; i < 4; i++) await login.login(ramesh, '0000');
    expect((await login.login(ramesh, '2468')).kind).toBe('ok');
    for (let i = 0; i < 4; i++) expect((await login.login(ramesh, '0000')).kind).toBe('wrong');
  });

  it('a PIN change synced to the phone clears offline unlock', async () => {
    const { server, vault, login } = setup();
    await login.login(ramesh, '2468');
    vault.forgetStale([{ ...ramesh, pin_version: 2 }]);
    server.state.online = false;
    expect(await login.login({ ...ramesh, pin_version: 2 }, '2468')).toEqual({ kind: 'needsInternet' });
  });

  it('a removal synced to the phone clears offline unlock', async () => {
    const { server, vault, login } = setup();
    await login.login(ramesh, '2468');
    vault.forgetStale([{ ...ramesh, removed_at: '2026-10-27T10:00:00Z', active: false }]);
    server.state.online = false;
    expect(await login.login(ramesh, '2468')).toEqual({ kind: 'needsInternet' });
  });

  it('the phone stores a salted hash, never the PIN itself', async () => {
    const { store, login } = setup({ ramesh: '2468', sita: '2468' });
    await login.login(ramesh, '2468');
    await login.login(sita, '2468');
    const saved = store.get('khata.pins') ?? '';
    expect(saved).not.toContain('2468');
    const entries = JSON.parse(saved) as Record<string, { salt: string; hash: string }>;
    // Same PIN, different salt: the stored hashes differ.
    expect(entries.ramesh?.hash).not.toBe(entries.sita?.hash);
  });

  it('a wrong PIN checked online does not count towards the offline lock', async () => {
    const { login } = setup();
    for (let i = 0; i < 6; i++) expect(await login.login(ramesh, '0000')).toEqual({ kind: 'wrong' });
    expect(await login.login(ramesh, '2468')).toEqual({ kind: 'ok' });
  });
});
