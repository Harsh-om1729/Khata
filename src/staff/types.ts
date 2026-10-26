export interface StaffMember {
  id: string;
  name: string;
  photo: string | null;
  is_owner: boolean;
  active: boolean;
  pin_version: number;
  removed_at: string | null;
}

/** Staff who can unlock this phone: not removed and not deactivated. */
export function canUnlock(member: StaffMember): boolean {
  return member.active && member.removed_at === null;
}
