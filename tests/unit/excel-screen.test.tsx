import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { KhataDb } from '../../src/db';
import { hi } from '../../src/i18n';
import type { StaffMember } from '../../src/staff/types';
import { APPROVED_ID, fakeDevice, fakeDeviceAdmin } from './fakes';

const owner: StaffMember = { id: 'staff-owner', name: 'Harsh', photo: null, is_owner: true, active: true, pin_version: 1, removed_at: null };
let db: KhataDb;

beforeEach(() => {
  localStorage.clear();
  db = new KhataDb(`test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  cleanup();
  await db.delete();
});

describe('Excel screen when its code cannot load', () => {
  it('says to turn on internet and reopen, not that the file is wrong', async () => {
    render(
      <App
        services={{
          db,
          // As when the phone is offline and the Excel code was never downloaded.
          loadExcel: () => Promise.reject(new Error('failed to fetch')),
          device: { ...fakeDevice({ id: APPROVED_ID, status: 'approved', code: 'A' }), cached: () => ({ id: APPROVED_ID, status: 'approved' as const, code: 'A' }) },
          deviceAdmin: fakeDeviceAdmin(),
          staffDirectory: { cached: () => [owner], refresh: async () => [owner] },
          staffLogin: { login: vi.fn(async () => ({ kind: 'ok' as const })), lockedUntil: () => null },
        }}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Harsh/ }));
    for (const digit of '2468') fireEvent.click(screen.getByRole('button', { name: digit }));
    fireEvent.click(await screen.findByRole('button', { name: hi.manageItems }));
    fireEvent.click(await screen.findByRole('button', { name: hi.excelTitle }));
    fireEvent.change(screen.getByLabelText(hi.chooseExcel), { target: { files: [new File(['x'], 'list.xlsx')] } });
    expect((await screen.findByRole('alert')).textContent).toContain(hi.excelLoadFailed);
    expect(screen.queryByText(hi.excelWrongFile)).toBeNull();
  });
});
