import { describe, expect, it } from 'vitest';
import { STATE_CODES, checkProfile, emptyProfile, gstinCheckChar, isValidGstin, normalizePhone, profileCompletion, type ShopProfile } from '../../src/profile';

const valid = (first14: string) => first14 + gstinCheckChar(first14);
const BIHAR_GSTIN = valid('10AABCU9603R1Z');
const profile = (fields: Partial<ShopProfile>): ShopProfile => ({ ...emptyProfile(), shop_name: 'Anand Hardware', ...fields });

describe('GSTIN (U-1)', () => {
  it('accepts a real GSTIN with a correct check character', () => {
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
  });

  it('rejects a typing mistake that keeps the format', () => {
    expect(isValidGstin('27AAPFU0939F1ZW')).toBe(false);
    expect(isValidGstin('27AAPFU0938F1ZV')).toBe(false);
  });

  it('rejects a wrong format', () => {
    for (const bad of ['', '27AAPFU0939F1Z', '27AAPFU0939F1ZVX', '27aapfu0939f1zv', 'AAAPFU0939F1ZV0', '27AAPFU0939F1YV']) {
      expect(isValidGstin(bad), bad).toBe(false);
    }
  });

  it('is optional, and is cleaned to upper case without spaces', () => {
    expect(checkProfile(profile({ gstin: '' })).problems).toEqual({});
    const lower = BIHAR_GSTIN.toLowerCase();
    const check = checkProfile(profile({ gstin: ` ${lower.slice(0, 5)} ${lower.slice(5)} ` }));
    expect(check.problems).toEqual({});
    expect(check.profile.gstin).toBe(BIHAR_GSTIN);
  });

  it('must start with the chosen state code', () => {
    expect(checkProfile(profile({ gstin: BIHAR_GSTIN, state: '10' })).problems).toEqual({});
    expect(checkProfile(profile({ gstin: BIHAR_GSTIN, state: '20' })).problems).toEqual({ gstin: 'gstinState' });
  });

  it('reports a bad GSTIN as a format problem', () => {
    expect(checkProfile(profile({ gstin: 'NOT-A-GSTIN' })).problems).toEqual({ gstin: 'gstin' });
  });
});

describe('required fields and limits (U-1)', () => {
  it('needs a shop name', () => {
    expect(checkProfile(profile({ shop_name: '   ' })).problems).toEqual({ shop_name: 'required' });
  });

  it('keeps the shop name and address within the server limits', () => {
    expect(checkProfile(profile({ shop_name: 'a'.repeat(81) })).problems).toEqual({ shop_name: 'tooLong' });
    expect(checkProfile(profile({ shop_name: 'a'.repeat(80) })).problems).toEqual({});
    expect(checkProfile(profile({ address: 'a'.repeat(201) })).problems).toEqual({ address: 'tooLong' });
  });

  it('squeezes extra spaces out of the shop name', () => {
    expect(checkProfile(profile({ shop_name: '  Anand   Hardware ' })).profile.shop_name).toBe('Anand Hardware');
  });

  it('accepts a 6-digit pincode that does not start with 0', () => {
    expect(checkProfile(profile({ pincode: '800 001' })).profile.pincode).toBe('800001');
    expect(checkProfile(profile({ pincode: '080001' })).problems).toEqual({ pincode: 'pincode' });
    expect(checkProfile(profile({ pincode: '80001' })).problems).toEqual({ pincode: 'pincode' });
  });

  it('accepts only known state codes', () => {
    expect(STATE_CODES).toHaveLength(36);
    expect(checkProfile(profile({ state: '10' })).problems).toEqual({});
    expect(checkProfile(profile({ state: '25' })).problems).toEqual({ state: 'state' });
  });

  it('lists every problem at once', () => {
    const { problems } = checkProfile({ ...emptyProfile(), phone1: '12', pincode: 'x' });
    expect(problems).toEqual({ shop_name: 'required', phone1: 'phone', pincode: 'pincode' });
  });
});

describe('phone numbers (U-1)', () => {
  it('keeps 10 digits from the ways people write them', () => {
    for (const raw of ['9876543210', '98765 43210', '98765-43210', '+91 98765 43210', '919876543210', '09876543210']) {
      expect(normalizePhone(raw), raw).toBe('9876543210');
    }
  });

  it('keeps a landline with its STD code', () => {
    expect(normalizePhone('0612 2345678')).toBe('6122345678');
  });

  it('rejects anything that is not a phone number', () => {
    for (const raw of ['', '98765', '98765432101', '0123456789', 'abcdefghij']) {
      expect(normalizePhone(raw), raw).toBeNull();
    }
  });

  it('saves the cleaned number', () => {
    const { profile: saved, problems } = checkProfile(profile({ phone1: '+91 98765 43210', phone2: 'call me' }));
    expect(saved.phone1).toBe('9876543210');
    expect(problems).toEqual({ phone2: 'phone' });
  });
});

describe('profile completion (U-1)', () => {
  it('is 0% when empty and 100% when all 7 fields are filled', () => {
    expect(profileCompletion(emptyProfile())).toBe(0);
    expect(profileCompletion({
      shop_name: 'Anand Hardware', gstin: BIHAR_GSTIN, phone1: '9876543210', phone2: '9876543211',
      address: 'Main Road', pincode: '800001', state: '10',
    })).toBe(100);
  });

  it('rounds to a whole percent', () => {
    expect(profileCompletion(profile({}))).toBe(14);
    expect(profileCompletion(profile({ phone1: '9876543210', state: '10' }))).toBe(43);
  });

  it('does not count a field holding only spaces', () => {
    expect(profileCompletion(profile({ address: '   ' }))).toBe(14);
  });
});
