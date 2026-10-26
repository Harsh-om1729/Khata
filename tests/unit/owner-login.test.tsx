import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { OwnerAuth, SignInResult } from '../../src/auth';
import { hi } from '../../src/i18n';

function fakeAuth(result: SignInResult, savedEmail: string | null = null) {
  let email = savedEmail;
  const auth = {
    signIn: vi.fn(async (e: string) => {
      if (result === 'ok') email = e;
      return result;
    }),
    signOut: vi.fn(async () => {
      email = null;
    }),
    currentOwnerEmail: vi.fn(async () => email),
  } satisfies OwnerAuth;
  return auth;
}

async function openLogin() {
  fireEvent.click(screen.getByRole('button', { name: hi.owner }));
  await screen.findByRole('heading', { name: hi.ownerLoginTitle });
}

function fillAndSubmit(email = 'owner@shop.in', password = 'secret-pass') {
  fireEvent.input(screen.getByLabelText(hi.email), { target: { value: email } });
  fireEvent.input(screen.getByLabelText(hi.password), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: hi.signIn }));
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('owner login', () => {
  it('signs in, shows the owner screen, and signs out back to home', async () => {
    const auth = fakeAuth('ok');
    render(<App ownerAuth={auth} />);
    await openLogin();
    fillAndSubmit();

    expect(await screen.findByText('owner@shop.in')).toBeTruthy();
    expect(auth.signIn).toHaveBeenCalledWith('owner@shop.in', 'secret-pass');

    fireEvent.click(screen.getByRole('button', { name: hi.signOut }));
    expect(await screen.findByText(hi.appReady)).toBeTruthy();
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it('goes straight to the owner screen when already signed in', async () => {
    render(<App ownerAuth={fakeAuth('ok', 'owner@shop.in')} />);
    fireEvent.click(screen.getByRole('button', { name: hi.owner }));
    expect(await screen.findByText('owner@shop.in')).toBeTruthy();
  });

  it.each([
    ['wrong', hi.errorWrong],
    ['offline', hi.errorOffline],
    ['notOwner', hi.errorNotOwner],
  ] as const)('shows a clear message when the result is %s', async (result, message) => {
    render(<App ownerAuth={fakeAuth(result)} />);
    await openLogin();
    fillAndSubmit();
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(screen.getByRole('heading', { name: hi.ownerLoginTitle })).toBeTruthy();
  });

  it('sends only one sign-in on a double tap', async () => {
    let finish: (r: SignInResult) => void = () => {};
    const auth = fakeAuth('ok');
    auth.signIn.mockImplementation(() => new Promise<SignInResult>((resolve) => (finish = resolve)));
    render(<App ownerAuth={auth} />);
    await openLogin();
    fillAndSubmit();
    await waitFor(() => expect(screen.getByRole('button', { name: hi.signingIn })).toHaveProperty('disabled', true));
    fireEvent.click(screen.getByRole('button', { name: hi.signingIn }));
    finish('wrong');
    await screen.findByRole('alert');
    expect(auth.signIn).toHaveBeenCalledOnce();
  });

  it('Back returns to home', async () => {
    render(<App ownerAuth={fakeAuth('ok')} />);
    await openLogin();
    fireEvent.click(screen.getByRole('button', { name: hi.back }));
    expect(await screen.findByText(hi.appReady)).toBeTruthy();
  });
});
