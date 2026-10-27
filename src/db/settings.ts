import { PROFILE_FIELDS, checkProfile, emptyProfile, type ProfileCheck, type ShopProfile } from '../profile';
import { stampRecord } from '../staff/stamp';
import type { Author } from './catalog';
import { putWithOutbox } from './outbox';
import type { KhataDb } from './schema';
import type { SettingsChangeRow } from './types';

export class ProfileInvalidError extends Error {
  constructor(readonly problems: ProfileCheck['problems']) {
    super('shop profile has mistakes');
    this.name = 'ProfileInvalidError';
  }
}

/** The newest change of each profile field wins. */
export async function shopProfile(db: KhataDb): Promise<ShopProfile> {
  const changes = await db.settings_changes.where('field').anyOf([...PROFILE_FIELDS]).sortBy('created_at');
  const profile = emptyProfile();
  for (const change of changes) {
    const field = PROFILE_FIELDS.find((f) => f === change.field);
    if (field) profile[field] = change.new_value ?? '';
  }
  return profile;
}

/** Writes one change record per field that differs. Returns the saved profile, cleaned. */
export async function saveShopProfile(db: KhataDb, author: Author, input: ShopProfile): Promise<ShopProfile> {
  const { profile, problems } = checkProfile(input);
  if (Object.keys(problems).length > 0) throw new ProfileInvalidError(problems);
  // Fail before the transaction if nobody is unlocked; each row then gets its own UUID.
  stampRecord(author.staff, author.deviceId);
  await db.transaction('rw', db.allTables(), async () => {
    const current = await shopProfile(db);
    const rows: SettingsChangeRow[] = PROFILE_FIELDS.filter((field) => profile[field] !== current[field]).map((field) => ({
      ...stampRecord(author.staff, author.deviceId),
      server_at: null,
      field,
      new_value: profile[field] === '' ? null : profile[field],
    }));
    await putWithOutbox(db, rows.map((row) => ({ table: 'settings_changes' as const, row })));
  });
  return profile;
}
