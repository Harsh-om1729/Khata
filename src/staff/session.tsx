import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useState } from 'preact/hooks';
import type { StaffMember } from './types';

interface StaffSession {
  active: StaffMember | null;
  unlock(member: StaffMember): void;
  /** Back to the staff tiles. Called after every saved bill (M2-5) and by the lock button. */
  lock(): void;
}

const SessionContext = createContext<StaffSession | null>(null);

// Kept in memory only, so closing the app always locks it (SPEC §2).
export function StaffSessionProvider({ children }: { children: ComponentChildren }) {
  const [active, setActive] = useState<StaffMember | null>(null);
  return (
    <SessionContext.Provider value={{ active, unlock: setActive, lock: () => setActive(null) }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useStaffSession(): StaffSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useStaffSession must be used inside StaffSessionProvider');
  return session;
}
