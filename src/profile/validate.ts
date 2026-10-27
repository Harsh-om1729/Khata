import type { ProfileField, ShopProfile } from './fields';
import { isValidGstin } from './gstin';
import { isStateCode } from './states';

export type ProfileProblem = 'required' | 'tooLong' | 'gstin' | 'gstinState' | 'phone' | 'pincode' | 'state';

export interface ProfileCheck {
  profile: ShopProfile;
  problems: Partial<Record<ProfileField, ProfileProblem>>;
}

/** Accepts spaces, dashes, +91 and a leading 0, and keeps the 10 digits. Returns null when it is not a phone number. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[\s-]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[1-9][0-9]{9}$/.test(digits) ? digits : null;
}

/** Cleans every field and lists what is wrong. Limits match the server's checks. */
export function checkProfile(input: ShopProfile): ProfileCheck {
  const profile: ShopProfile = {
    shop_name: input.shop_name.trim().replace(/\s+/g, ' '),
    gstin: input.gstin.replace(/\s/g, '').toUpperCase(),
    phone1: input.phone1.trim(),
    phone2: input.phone2.trim(),
    address: input.address.trim(),
    pincode: input.pincode.replace(/\s/g, ''),
    state: input.state,
  };
  const problems: ProfileCheck['problems'] = {};

  if (profile.shop_name === '') problems.shop_name = 'required';
  else if (profile.shop_name.length > 80) problems.shop_name = 'tooLong';

  if (profile.gstin !== '' && !isValidGstin(profile.gstin)) problems.gstin = 'gstin';
  // A GSTIN belongs to one state, so it must start with the shop's state code.
  else if (profile.gstin !== '' && profile.state !== '' && !profile.gstin.startsWith(profile.state)) problems.gstin = 'gstinState';

  for (const field of ['phone1', 'phone2'] as const) {
    if (profile[field] === '') continue;
    const phone = normalizePhone(profile[field]);
    if (phone === null) problems[field] = 'phone';
    else profile[field] = phone;
  }

  if (profile.address.length > 200) problems.address = 'tooLong';
  if (profile.pincode !== '' && !/^[1-9][0-9]{5}$/.test(profile.pincode)) problems.pincode = 'pincode';
  if (profile.state !== '' && !isStateCode(profile.state)) problems.state = 'state';

  return { profile, problems };
}
