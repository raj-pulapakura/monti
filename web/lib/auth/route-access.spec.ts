import { describe, expect, it } from 'vitest';
import { resolveAuthRouteRedirect } from './route-access';

describe('resolveAuthRouteRedirect', () => {
  it('redirects /auth to /auth/sign-in', () => {
    const redirect = resolveAuthRouteRedirect({
      pathname: '/auth',
      search: '',
      hasUser: false,
    });

    expect(redirect).toBe('/auth/sign-in');
  });

  it('redirects unauthenticated protected route requests to sign-in', () => {
    const redirect = resolveAuthRouteRedirect({
      pathname: '/app/projects',
      search: '?tab=recent',
      hasUser: false,
    });

    expect(redirect).toBe('/auth/sign-in?next=%2Fapp%2Fprojects%3Ftab%3Drecent');
  });

  it('redirects authenticated auth-entry visits to /app', () => {
    const redirect = resolveAuthRouteRedirect({
      pathname: '/auth/sign-in',
      search: '',
      hasUser: true,
    });

    expect(redirect).toBe('/app');
  });

  it('returns null when no redirect is required', () => {
    const redirect = resolveAuthRouteRedirect({
      pathname: '/auth/sign-up',
      search: '',
      hasUser: false,
    });

    expect(redirect).toBeNull();
  });
});
