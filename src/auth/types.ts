export type SignInResult = 'ok' | 'wrong' | 'offline' | 'notOwner';

export interface OwnerAuth {
  signIn(email: string, password: string): Promise<SignInResult>;
  signOut(): Promise<void>;
  /** The signed-in owner's email from the saved session, or null. Works offline. */
  currentOwnerEmail(): Promise<string | null>;
}
