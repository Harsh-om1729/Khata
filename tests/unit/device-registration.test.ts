import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { createDeviceRegistration, RegistrationRefusedError, type KeyValueStore } from '../../src/sync/device-registration';

const memory = (): KeyValueStore => {
  const data = new Map<string, string>();
  return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
};

// Just enough of the client for the sign-in step of refresh().
function clientWhoseSignInFails(error: { name: string; status: number; message: string }): SupabaseClient {
  const fake = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInAnonymously: async () => ({ data: { user: null, session: null }, error }),
    },
  };
  return fake as unknown as SupabaseClient;
}

describe('device registration errors', () => {
  it('a server refusal (anonymous sign-ins off) is reported as refused, not offline', async () => {
    const client = clientWhoseSignInFails({ name: 'AuthApiError', status: 422, message: 'Anonymous sign-ins are disabled' });
    const registration = createDeviceRegistration(async () => client, memory());
    await expect(registration.refresh()).rejects.toBeInstanceOf(RegistrationRefusedError);
  });

  it('a network failure is not reported as refused', async () => {
    const client = clientWhoseSignInFails({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' });
    const registration = createDeviceRegistration(async () => client, memory());
    const error: unknown = await registration.refresh().catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(RegistrationRefusedError);
  });
});
