import { PROFILE_FIELDS, type ShopProfile } from './fields';

/** Whole percent of profile fields that are filled (SPEC §2.1). */
export function profileCompletion(profile: ShopProfile): number {
  const filled = PROFILE_FIELDS.filter((field) => profile[field].trim() !== '').length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}
