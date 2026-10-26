import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import type { OwnerAuth } from './types';

const OwnerAuthContext = createContext<OwnerAuth | null>(null);

export function OwnerAuthProvider({ auth, children }: { auth: OwnerAuth; children: ComponentChildren }) {
  return <OwnerAuthContext.Provider value={auth}>{children}</OwnerAuthContext.Provider>;
}

export function useOwnerAuth(): OwnerAuth {
  const auth = useContext(OwnerAuthContext);
  if (!auth) throw new Error('useOwnerAuth must be used inside OwnerAuthProvider');
  return auth;
}
