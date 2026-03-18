import { describe, expect, it, vi } from 'vitest';
import {
  LOCAL_SITE_URL,
  buildOAuthRedirectUrl,
  buildPasswordRecoveryRedirectUrl,
  signInWithEmailPassword,
  signInWithOAuthProvider,
  signUpWithEmailPassword,
  sendPasswordRecoveryEmail,
  validateLocalAuthControlPlaneConfig,
} from './auth-flow';
import { resolveAuthRouteRedirect } from './route-access';

function createAuthClientMock() {
  return {
    signInWithPassword: vi.fn(async () => ({ error: null })),
    signInWithOAuth: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  };
}

describe('auth flow e2e coverage', () => {
  it('executes OAuth sign-in with callback redirect carrying next path', async () => {
    const auth = createAuthClientMock();

    await signInWithOAuthProvider(auth, {
      provider: 'google',
      origin: LOCAL_SITE_URL,
      nextPath: '/app?tab=recent',
    });

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${LOCAL_SITE_URL}/auth/callback?next=%2Fapp%3Ftab%3Drecent`,
      },
    });
  });

  it('executes email/password sign-in and sign-up using expected redirect targets', async () => {
    const auth = createAuthClientMock();

    await signInWithEmailPassword(auth, {
      email: '  user@example.test  ',
      password: 'password-123',
    });
    await signUpWithEmailPassword(auth, {
      email: '  new-user@example.test  ',
      password: 'password-456',
      origin: LOCAL_SITE_URL,
    });

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.test',
      password: 'password-123',
    });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'new-user@example.test',
      password: 'password-456',
      options: {
        emailRedirectTo: `${LOCAL_SITE_URL}/auth/callback?next=%2Fapp`,
      },
    });
  });

  it('executes forgot-password recovery with local reset redirect URL', async () => {
    const auth = createAuthClientMock();

    await sendPasswordRecoveryEmail(auth, {
      email: '  recovery@example.test  ',
      origin: LOCAL_SITE_URL,
    });

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('recovery@example.test', {
      redirectTo: `${LOCAL_SITE_URL}/auth/reset-password`,
    });
    expect(buildPasswordRecoveryRedirectUrl(LOCAL_SITE_URL)).toBe(
      `${LOCAL_SITE_URL}/auth/reset-password`,
    );
  });

  it('keeps /app protected while allowing authenticated app access', () => {
    const unauthenticatedRedirect = resolveAuthRouteRedirect({
      pathname: '/app',
      search: '',
      hasUser: false,
    });
    const authenticatedRedirect = resolveAuthRouteRedirect({
      pathname: '/app',
      search: '',
      hasUser: true,
    });

    expect(unauthenticatedRedirect).toBe('/auth/sign-in?next=%2Fapp');
    expect(authenticatedRedirect).toBeNull();
    expect(
      buildOAuthRedirectUrl({
        origin: LOCAL_SITE_URL,
        nextPath: '/app',
      }),
    ).toBe(`${LOCAL_SITE_URL}/auth/callback?next=%2Fapp`);
  });

  it('validates local-only auth control-plane site and redirect URLs', () => {
    const valid = validateLocalAuthControlPlaneConfig({
      siteUrl: 'http://localhost:3000',
      redirectAllowList: [
        'http://localhost:3000/auth/callback',
        'http://localhost:3000/auth/reset-password',
      ],
    });
    const invalid = validateLocalAuthControlPlaneConfig({
      siteUrl: 'https://monti.example.com',
      redirectAllowList: [
        'https://monti.example.com/auth/callback',
        'http://localhost:3000/auth/reset-password',
      ],
    });

    expect(valid.ok).toBe(true);
    expect(valid.errors).toEqual([]);
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
  });
});
