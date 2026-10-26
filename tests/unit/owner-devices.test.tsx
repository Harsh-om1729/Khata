import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import type { OwnerAuth } from '../../src/auth';
import { hi } from '../../src/i18n';
import { APPROVED_ID, deviceRow, fakeDevice, fakeDeviceAdmin, PENDING_ID } from './fakes';

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
        device: fakeDevice({ id: APPROVED_ID, status: 'approved', code: 'A' }),
        deviceAdmin: admin,
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: hi.owner }));
  await screen.findByRole('heading', { name: hi.phones });
}

async function rowFor(code: string) {
  const codeEl = await screen.findByText(code);
  const row = codeEl.closest('li');
  if (!row) throw new Error(`no row for ${code}`);
  return within(row);
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('owner phone list', () => {
  it('approves a pending phone, which then gets a bill letter', async () => {
    const admin = fakeDeviceAdmin([deviceRow(PENDING_ID, 'pending')]);
    await openPhones(admin);
    const row = await rowFor('3F9 A2C');
    fireEvent.click(row.getByRole('button', { name: hi.approve }));
    expect(await row.findByText(new RegExp(`${hi.billLetter} A`))).toBeTruthy();
    expect(admin.approve).toHaveBeenCalledWith(PENDING_ID);
  });

  it('turning a phone off needs a second tap to confirm', async () => {
    const admin = fakeDeviceAdmin([deviceRow(APPROVED_ID, 'approved', 'A')]);
    await openPhones(admin);
    const row = await rowFor('B7D 40E');
    fireEvent.click(row.getByRole('button', { name: hi.revoke }));
    expect(admin.revoke).not.toHaveBeenCalled();

    fireEvent.click(row.getByRole('button', { name: hi.cancel }));
    expect(admin.revoke).not.toHaveBeenCalled();

    fireEvent.click(row.getByRole('button', { name: hi.revoke }));
    fireEvent.click(row.getByRole('button', { name: hi.confirmRevoke }));
    expect(await row.findByText(hi.statusRevoked)).toBeTruthy();
    expect(admin.revoke).toHaveBeenCalledWith(APPROVED_ID);
  });

  it('a turned-off phone can be approved again', async () => {
    const admin = fakeDeviceAdmin([deviceRow(APPROVED_ID, 'revoked', 'A')]);
    await openPhones(admin);
    const row = await rowFor('B7D 40E');
    fireEvent.click(row.getByRole('button', { name: hi.approveAgain }));
    expect(await row.findByText(hi.statusApproved)).toBeTruthy();
  });

  it('lists pending phones first', async () => {
    await openPhones(fakeDeviceAdmin([deviceRow(APPROVED_ID, 'approved', 'A'), deviceRow(PENDING_ID, 'pending')]));
    await screen.findByText('3F9 A2C');
    const codes = screen.getAllByTestId('phone-row').map((li) => li.querySelector('.phone__code')?.textContent);
    expect(codes).toEqual(['3F9 A2C', 'B7D 40E']);
  });

  it('shows a message when an action fails', async () => {
    const admin = fakeDeviceAdmin([deviceRow(PENDING_ID, 'pending')]);
    admin.approve.mockRejectedValueOnce(new Error('offline'));
    await openPhones(admin);
    fireEvent.click((await rowFor('3F9 A2C')).getByRole('button', { name: hi.approve }));
    expect((await screen.findByRole('alert')).textContent).toContain(hi.actionFailed);
  });
});
