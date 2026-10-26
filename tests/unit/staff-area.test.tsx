import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { StaffAdmin } from '../../src/auth/staff-admin';
import { hi } from '../../src/i18n';
import type { LoginResult, StaffLogin } from '../../src/staff/staff-login';
import type { StaffMember } from '../../src/staff/types';
import { APPROVED_ID, fakeDevice, fakeDeviceAdmin } from './fakes';

const member = (id: string, name: string, extra: Partial<StaffMember> = {}): StaffMember => ({
  id, name, photo: null, is_owner: false, active: true, pin_version: 1, removed_at: null, ...extra,
});
const ramesh = member('ramesh', 'Ramesh');
const owner = member('owner', 'Harsh', { is_owner: true });
const removed = member('gone', 'Gone', { removed_at: '2026-10-27T00:00:00Z', active: false });

function renderHome(login: StaffLogin, list: StaffMember[] = [ramesh, owner, removed]) {
  render(
    <App
      services={{
        device: fakeDevice({ id: APPROVED_ID, status: 'approved', code: 'A' }),
        deviceAdmin: fakeDeviceAdmin(),
        staffDirectory: { cached: () => list, refresh: async () => list },
        staffLogin: login,
      }}
    />,
  );
}

const loginReturning = (result: LoginResult) => ({ login: vi.fn(async () => result), lockedUntil: () => null });

async function typePin(pin: string) {
  for (const digit of pin) fireEvent.click(screen.getByRole('button', { name: digit }));
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('staff tiles and PIN pad', () => {
  it('shows a tile per staff member who can unlock, not removed ones', async () => {
    renderHome(loginReturning({ kind: 'ok' }));
    expect(await screen.findByText(hi.staffChoose)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ramesh/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Harsh/ }).textContent).toContain(hi.owner);
    expect(screen.queryByRole('button', { name: /Gone/ })).toBeNull();
  });

  it('tile, then 4 digits, unlocks; Lock goes back to the tiles', async () => {
    const login = loginReturning({ kind: 'ok' });
    renderHome(login);
    fireEvent.click(await screen.findByRole('button', { name: /Ramesh/ }));
    await typePin('2468');
    expect(await screen.findByText('Ramesh', { selector: 'strong' })).toBeTruthy();
    expect(login.login).toHaveBeenCalledWith(ramesh, '2468');

    fireEvent.click(screen.getByRole('button', { name: hi.lockNow }));
    expect(await screen.findByText(hi.staffChoose)).toBeTruthy();
  });

  it.each([
    [{ kind: 'wrong' } as const, hi.pinWrong],
    [{ kind: 'needsInternet' } as const, hi.pinNeedsInternet],
    [{ kind: 'locked', until: Date.now() + 5 * 60_000 } as const, hi.pinLocked],
  ])('shows a clear message for %o', async (result, message) => {
    renderHome(loginReturning(result));
    fireEvent.click(await screen.findByRole('button', { name: /Ramesh/ }));
    await typePin('0000');
    expect((await screen.findByRole('alert')).textContent).toContain(message);
  });

  it('while locked, the number keys are disabled', async () => {
    renderHome(loginReturning({ kind: 'locked', until: Date.now() + 5 * 60_000 }));
    fireEvent.click(await screen.findByRole('button', { name: /Ramesh/ }));
    await typePin('0000');
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: '5' }).hasAttribute('disabled')).toBe(true);
  });

  it('says so when there are no staff yet', async () => {
    renderHome(loginReturning({ kind: 'ok' }), []);
    expect(await screen.findByText(hi.staffNone)).toBeTruthy();
  });
});

describe('owner staff screen', () => {
  function fakeStaffAdmin(initial: StaffMember[]) {
    let rows = [...initial];
    return {
      list: vi.fn(async () => rows),
      add: vi.fn(async ({ name, isOwner }: { name: string; pin: string; isOwner: boolean }) => {
        rows = [...rows, member(name.toLowerCase(), name, { is_owner: isOwner })];
      }),
      resetPin: vi.fn(async () => {}),
      remove: vi.fn(async (staffId: string) => {
        rows = rows.filter((r) => r.id !== staffId);
      }),
    } satisfies StaffAdmin;
  }

  async function openOwner(admin: StaffAdmin) {
    render(
      <App
        services={{
          ownerAuth: { signIn: async () => 'ok', signOut: async () => {}, currentOwnerEmail: async () => 'o@shop.in' },
          device: fakeDevice({ id: APPROVED_ID, status: 'approved', code: 'A' }),
          deviceAdmin: fakeDeviceAdmin(),
          staffDirectory: { cached: () => [], refresh: async () => [] },
          staffAdmin: admin,
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: hi.owner }));
    await screen.findByRole('heading', { name: hi.staff });
  }

  it('adds a staff member with a 4-digit PIN', async () => {
    const admin = fakeStaffAdmin([]);
    await openOwner(admin);
    fireEvent.input(screen.getByLabelText(hi.staffName), { target: { value: 'Mohan' } });
    fireEvent.input(screen.getByLabelText(hi.staffPin), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: hi.addStaff }));
    expect(await screen.findByText('Mohan')).toBeTruthy();
    expect(admin.add).toHaveBeenCalledWith({ name: 'Mohan', pin: '1234', isOwner: false });
  });

  it('refuses a PIN that is not 4 digits', async () => {
    const admin = fakeStaffAdmin([]);
    await openOwner(admin);
    fireEvent.input(screen.getByLabelText(hi.staffName), { target: { value: 'Mohan' } });
    fireEvent.input(screen.getByLabelText(hi.staffPin), { target: { value: '12a' } });
    fireEvent.click(screen.getByRole('button', { name: hi.addStaff }));
    expect((await screen.findByRole('alert')).textContent).toContain(hi.pinFormat);
    expect(admin.add).not.toHaveBeenCalled();
  });

  it('resets a PIN and removes a staff member (removal needs a second tap)', async () => {
    const admin = fakeStaffAdmin([ramesh]);
    await openOwner(admin);
    await screen.findByText('Ramesh');

    fireEvent.click(screen.getByRole('button', { name: hi.newPin }));
    fireEvent.input(screen.getByLabelText(hi.newPin), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: hi.savePin }));
    await vi.waitFor(() => expect(admin.resetPin).toHaveBeenCalledWith('ramesh', '9999'));

    fireEvent.click(await screen.findByRole('button', { name: hi.removeStaff }));
    expect(admin.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: hi.confirmRemove }));
    await vi.waitFor(() => expect(admin.remove).toHaveBeenCalledWith('ramesh'));
    await vi.waitFor(() => expect(screen.queryByText('Ramesh')).toBeNull());
  });
});
