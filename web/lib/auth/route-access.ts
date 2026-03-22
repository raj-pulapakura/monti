import { resolveSafeNextPath } from './next-path';

const AUTH_ENTRY_ROUTES = new Set([
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/forgot-password',
]);

export function resolveAuthRouteRedirect(input: {
  pathname: string;
  search: string;
  hasUser: boolean;
}): string | null {
  const { pathname, search, hasUser } = input;
  if (pathname === '/auth') {
    return '/auth/sign-in';
  }

  if (pathname.startsWith('/chat') && !hasUser) {
    const nextPath = resolveSafeNextPath(`${pathname}${search}`);
    return `/auth/sign-in?next=${encodeURIComponent(nextPath)}`;
  }

  if (AUTH_ENTRY_ROUTES.has(pathname) && hasUser) {
    return '/';
  }

  return null;
}
