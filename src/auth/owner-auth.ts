import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../sync/supabase-client';
import type { OwnerAuth, SignInResult } from './types';

interface AuthErrorLike {
  name?: string;
  status?: number;
}

function isNetworkError(error: AuthErrorLike): boolean {
  return error.name === 'AuthRetryableFetchError' || error.status === 0 || error.status === undefined;
}

export function createOwnerAuth(load: () => Promise<SupabaseClient> = getSupabase): OwnerAuth {
  return {
    async signIn(email, password): Promise<SignInResult> {
      if (!navigator.onLine) return 'offline';
      let supabase: SupabaseClient;
      try {
        supabase = await load();
      } catch {
        return 'offline';
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return isNetworkError(error) ? 'offline' : 'wrong';

      const { data: isOwner, error: rpcError } = await supabase.rpc('is_owner');
      if (rpcError || isOwner !== true) {
        // A valid account that is not the owner must not stay signed in on this phone.
        await supabase.auth.signOut({ scope: 'local' });
        return rpcError ? 'offline' : 'notOwner';
      }
      return 'ok';
    },

    async signOut() {
      const supabase = await load();
      const { error } = await supabase.auth.signOut();
      // Offline: still forget the session on this phone; the server token simply expires.
      if (error) await supabase.auth.signOut({ scope: 'local' });
    },

    async currentOwnerEmail() {
      const supabase = await load();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      // Anonymous sessions belong to staff phones (M0-6); non-owners are signed out at sign-in.
      if (!user || user.is_anonymous) return null;
      return user.email ?? null;
    },
  };
}
