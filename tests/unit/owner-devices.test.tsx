import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { OwnerAuth } from '../../src/auth';
import { hi } from '../../src/i18n';
import { APPROVED_ID, deviceRow, fakeDevice, fakeDeviceAdmin, PENDING_ID } from './fakes';

const OWNER_PHONE = 'c0ffee00-0000-4000-8000-0000000000aa';

const signedInOwner: OwnerAuth = {
  signIn: async () => 'ok',
  signOut: async () => {},
  currentOwnerEmail: async () => 'owner@shop.in',
};

async function openPhones(admin: ReturnType<typeof fakeDeviceAdmin>) {
  render(
    <App
      services={{
        ownerAuth: signedInOwner,
        device: fakeDevice({ id: OWNER_PHONE, status: 'approved', code: 'A' }, { id: OWNER_PHONE, status: 'approved', code: 'A' }),
        deviceAdmin: admin,
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: hi.owner }));
  await screen.findByRole('heading', { name: hi.phones });
}

async function card(name: string) {
  const el = await screen.findByText(name, { selector: '.phone__name' });
  const row = el.closest('li');
  if (!row) throw new Error(`no card for ${name}`);
  return within(row);
}

const counter = () => screen.queryByRole('button', { name: new RegExp(hi.phonesTurnedOff) });

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('owner phone list (M0-6c)', () => {
  it('each card shows the name, the code smaller underneath, and last seen', async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    await openPhones(fakeDeviceAdmin([
      deviceRow(APPROVED_ID, 'approved', 'B', { name: 'Counter phone', last_seen: fiveMinAgo }),
      deviceRow(PENDING_ID, 'pending', null, { name: 'New phone' }),
    ]));
    const counterCard = await card('Counter phone');
    expect(counterCard.getByText('B7D 40E').className).toContain('phone__code');
    expect(counterCard.getByText(/मिनट पहले/).textContent).toContain(hi.lastSeen);
    expect((await card('New phone')).getByText(new RegExp(hi.lastSeenNever))).toBeTruthy();
  });

  it('approves a pending phone, which then gets a bill letter', async () => {
    const admin = fakeDeviceAdmin([deviceRow(PENDING_ID, 'pending', null, { name: 'New phone' })]);
    await openPhones(admin);
    fireEvent.click((await card('New phone')).getByRole('button', { name: hi.approve }));
    expect(await (await card('New phone')).findByText(new RegExp(`${hi.billLetter} A`))).toBeTruthy();
  });

  it('turning off asks first, then moves the phone into the collapsed "turned off" section', async () => {
    const admin = fakeDeviceAdmin([deviceRow(APPROVED_ID, 'approved', 'B', { name: 'Counter phone' })]);
    await openPhones(admin);
    const c = await card('Counter phone');
    fireEvent.click(c.getByRole('button', { name: hi.revoke }));
    expect(admin.revoke).not.toHaveBeenCalled();
    fireEvent.click(c.getByRole('button', { name: hi.cancel }));
    fireEvent.click(c.getByRole('button', { name: hi.revoke }));
    fireEvent.click(c.getByRole('button', { name: hi.confirmRevoke }));

    const toggle = await screen.findByRole('button', { name: `${hi.phonesTurnedOff} (1)` });
    expect(screen.queryByText('Counter phone')).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect((await card('Counter phone')).getByText(hi.statusRevoked)).toBeTruthy();
  });

  it('a turned-off phone can be approved again from the collapsed section', async () => {
    await openPhones(fakeDeviceAdmin([deviceRow(APPROVED_ID, 'revoked', 'B', { name: 'Lost phone' })]));
    fireEvent.click(await screen.findByRole('button', { name: `${hi.phonesTurnedOff} (1)` }));
    fireEvent.click((await card('Lost phone')).getByRole('button', { name: hi.approveAgain }));
    await vi.waitFor(() => expect(counter()).toBeNull());
    expect((await card('Lost phone')).getByText(hi.statusApproved)).toBeTruthy();
  });

  it('the owner cannot turn off the phone he is using right now', async () => {
    await openPhones(fakeDeviceAdmin([deviceRow(OWNER_PHONE, 'approved', 'A', { name: 'Owner phone' })]));
    const c = await card('Owner phone');
    expect(c.getByText(hi.thisPhone)).toBeTruthy();
    expect(c.queryByRole('button', { name: hi.revoke })).toBeNull();
  });

  it('the owner renames a phone', async () => {
    const admin = fakeDeviceAdmin([deviceRow(APPROVED_ID, 'approved', 'B', { name: 'B7D 40E' })]);
    await openPhones(admin);
    fireEvent.click((await card('B7D 40E')).getByRole('button', { name: hi.rename }));
    fireEvent.input(screen.getByLabelText(hi.phoneName), { target: { value: 'Ramesh counter' } });
    fireEvent.click(screen.getByRole('button', { name: hi.saveName }));
    expect(await screen.findByText('Ramesh counter')).toBeTruthy();
    expect(admin.rename).toHaveBeenCalledWith(APPROVED_ID, 'Ramesh counter');
  });

  it('lists pending phones first', async () => {
    await openPhones(fakeDeviceAdmin([
      deviceRow(APPROVED_ID, 'approved', 'B', { name: 'Old phone' }),
      deviceRow(PENDING_ID, 'pending', null, { name: 'New phone' }),
    ]));
    await screen.findByText('New phone');
    const names = screen.getAllByTestId('phone-row').map((li) => li.querySelector('.phone__name')?.textContent);
    expect(names).toEqual(['New phone', 'Old phone']);
  });

  it('shows a message when an action fails', async () => {
    const admin = fakeDeviceAdmin([deviceRow(PENDING_ID, 'pending', null, { name: 'New phone' })]);
    admin.approve.mockRejectedValueOnce(new Error('offline'));
    await openPhones(admin);
    fireEvent.click((await card('New phone')).getByRole('button', { name: hi.approve }));
    expect((await screen.findByRole('alert')).textContent).toContain(hi.actionFailed);
  });
});
