import type { Author } from '../db';
import { useServices } from '../services';
import { useStaffSession } from './session';

/** The unlocked person and this phone, stamped on every record they save. */
export function useAuthor(): Author {
  const { device } = useServices();
  const { active } = useStaffSession();
  return { staff: active, deviceId: device.cached()?.id ?? null };
}
