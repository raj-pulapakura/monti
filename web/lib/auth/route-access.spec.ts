import { describe, expect, it } from 'vitest';
import { resolveAuthRouteRedirect } from './route-access';

describe('resolveAuthRouteRedirect', () => {
  it('keeps authenticated root visits at /', () => {
    const redirect = resolveAuthRouteRedirect({
      pathname: '/',
      search: '',
      hasUser: true,
    });

    expect(redirect).toBeNull();
  });

  it('redirects /auth to /sign-in', () => {
    const redirect = resolveAuthRouteRedirect({
      pathname: '/auth',
      search: '',
      hasUser: false,
    });

    expect(redirect).toBe('/sign-in');
  });

  it('redirects unauthenticated protected route requests to sign-in', () => {
    const redirect = resolveAuthRouteRedirect({
      pathname: '/chat/abc123',
      search: '?tab=recent',
      hasUser: false,
    });

    expect(redirect).toBe('/sign-in?next=%2Fchat%2Fabc123%3Ftab%3Drecent');
  });

  it('redirects authenticated auth-entry visits to /', () => {
    const redirect = resolveAuthRouteRedirect({
      pathname: '/sign-in',
      search: '',
      hasUser: true,
    });

    expect(redirect).toBe('/');
  });

  it('returns null when no redirect is required', () => {
    const redirect = resolveAuthRouteRedirect({
      pathname: '/sign-up',
      search: '',
      hasUser: false,
    });

    expect(redirect).toBeNull();
  });
});
