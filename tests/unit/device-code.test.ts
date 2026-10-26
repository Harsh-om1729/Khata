import { describe, expect, it } from 'vitest';
import { nextFreeCode, registrationCode } from '../../src/sync/device-code';

describe('registration code', () => {
  it('is the first 6 characters of the device id, grouped for reading aloud', () => {
    expect(registrationCode('3f9a2c11-0000-4000-8000-000000000001')).toBe('3F9 A2C');
  });
});

describe('next free bill letter', () => {
  it('starts at A and skips letters in use', () => {
    expect(nextFreeCode([])).toBe('A');
    expect(nextFreeCode(['A', 'B', 'D'])).toBe('C');
  });

  it('moves on to A1 after Z, and every result is a valid device code', () => {
    const all = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    expect(nextFreeCode(all)).toBe('A1');
    expect(nextFreeCode([...all, 'A1'])).toBe('B1');
    expect(nextFreeCode([...all, 'A1'])).toMatch(/^[A-Z][A-Z0-9]{0,2}$/);
  });
});
