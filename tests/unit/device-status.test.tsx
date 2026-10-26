import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { hi } from '../../src/i18n';
import { RegistrationRefusedError } from '../../src/sync/device-registration';
import { APPROVED_ID, fakeDevice, fakeDeviceAdmin, PENDING_ID } from './fakes';
import type { FakeDevice } from './fakes';

const pending = { id: PENDING_ID, status: 'pending' as const, code: null };
const approved = { id: APPROVED_ID, status: 'approved' as const, code: 'A' };
const revoked = { id: APPROVED_ID, status: 'revoked' as const, code: 'A' };

function renderWith(device: FakeDevice) {
  render(<App services={{ device, deviceAdmin: fakeDeviceAdmin() }} />);
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('phone status on the home screen', () => {
  it('a new phone shows its registration code for the owner', async () => {
    renderWith(fakeDevice(pending));
    expect(await screen.findByText('3F9 A2C')).toBeTruthy();
    expect(screen.getByText(hi.devicePending)).toBeTruthy();
  });

  it('an approved phone shows approved with its bill letter', async () => {
    renderWith(fakeDevice(approved));
    expect(await screen.findByText(`${hi.deviceApproved} (A)`)).toBeTruthy();
  });

  it('a revoked phone says it is turned off', async () => {
    renderWith(fakeDevice(revoked));
    expect(await screen.findByText(hi.deviceRevoked)).toBeTruthy();
  });

  it('offline on first ever start asks for internet', async () => {
    renderWith(fakeDevice(new Error('offline')));
    expect(await screen.findByText(hi.deviceNeedInternet)).toBeTruthy();
  });

  it('a server refusal says to tell the owner, not to turn on internet', async () => {
    renderWith(fakeDevice(new RegistrationRefusedError({ status: 422 })));
    expect(await screen.findByText(hi.deviceRefused)).toBeTruthy();
    expect(screen.queryByText(hi.deviceNeedInternet)).toBeNull();
  });

  it('offline later keeps showing the last known status', async () => {
    renderWith(fakeDevice(new Error('offline'), approved));
    expect(await screen.findByText(`${hi.deviceApproved} (A)`)).toBeTruthy();
    expect(screen.queryByText(hi.deviceNeedInternet)).toBeNull();
  });

  it('Check again picks up the approval', async () => {
    const device = fakeDevice(pending).next(approved);
    renderWith(device);
    await screen.findByText('3F9 A2C');
    fireEvent.click(screen.getByRole('button', { name: hi.checkAgain }));
    expect(await screen.findByText(`${hi.deviceApproved} (A)`)).toBeTruthy();
  });

  it('a pending phone checks again by itself every 30 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const device = fakeDevice(pending).next(approved);
    renderWith(device);
    await screen.findByText('3F9 A2C');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await screen.findByText(`${hi.deviceApproved} (A)`)).toBeTruthy();
    expect(device.refresh).toHaveBeenCalledTimes(2);
  });
});
