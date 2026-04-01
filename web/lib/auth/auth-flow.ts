import type { GoTrueClient, Provider } from '@supabase/supabase-js';

export const LOCAL_SITE_URL = 'http://localhost:3000';
export const AUTH_CALLBACK_PATH = '/auth/callback';
export const AUTH_RESET_PASSWORD_PATH = '/auth/reset-password';

type AuthClient = Pick<
  GoTrueClient,
  'signInWithPassword' | 'signInWithOAuth' | 'signUp' | 'resetPasswordForEmail'
>;

export function buildOAuthRedirectUrl(input: {
  origin: string;
  nextPath: string;
}): string {
  return `${resolveAuthRedirectOrigin(input.origin)}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(input.nextPath)}`;
}

export function buildSignUpEmailRedirectUrl(input: {
  origin: string;
  nextPath: string;
}): string {
  return `${resolveAuthRedirectOrigin(input.origin)}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(input.nextPath)}`;
}

export function buildPasswordRecoveryRedirectUrl(origin: string): string {
  return `${origin}${AUTH_RESET_PASSWORD_PATH}`;
}

export async function signInWithEmailPassword(
  auth: AuthClient,
  input: {
    email: string;
    password: string;
  },
) {
  return auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
}

export async function signInWithOAuthProvider(
  auth: AuthClient,
  input: {
    provider: Provider;
    origin: string;
    nextPath: string;
  },
) {
  return auth.signInWithOAuth({
    provider: input.provider,
    options: {
      redirectTo: buildOAuthRedirectUrl({
        origin: input.origin,
        nextPath: input.nextPath,
      }),
    },
  });
}

export async function signUpWithEmailPassword(
  auth: AuthClient,
  input: {
    email: string;
    password: string;
    origin: string;
    nextPath: string;
  },
) {
  return auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: buildSignUpEmailRedirectUrl({
        origin: input.origin,
        nextPath: input.nextPath,
      }),
    },
  });
}

function resolveAuthRedirectOrigin(origin: string): string {
  // In local dev we force localhost callback URLs to avoid OAuth falling back to staged Site URL.
  if (process.env.NODE_ENV === 'development') {
    return LOCAL_SITE_URL;
  }

  return origin;
}

export async function sendPasswordRecoveryEmail(
  auth: AuthClient,
  input: {
    email: string;
    origin: string;
  },
) {
  return auth.resetPasswordForEmail(input.email.trim(), {
    redirectTo: buildPasswordRecoveryRedirectUrl(input.origin),
  });
}

export function validateLocalAuthControlPlaneConfig(input: {
  siteUrl: string;
  redirectAllowList: string[];
}): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const normalizedSiteUrl = normalizeComparableUrl(input.siteUrl);

  if (normalizedSiteUrl !== LOCAL_SITE_URL) {
    errors.push(`Site URL must be ${LOCAL_SITE_URL}.`);
  }

  const requiredRedirects = new Set([
    `${LOCAL_SITE_URL}${AUTH_CALLBACK_PATH}`,
    `${LOCAL_SITE_URL}${AUTH_RESET_PASSWORD_PATH}`,
  ]);
  const normalizedRedirects = input.redirectAllowList.map((value) =>
    normalizeComparableUrl(value),
  );

  for (const requiredRedirect of requiredRedirects) {
    if (!normalizedRedirects.includes(requiredRedirect)) {
      errors.push(`Redirect allow-list must include ${requiredRedirect}.`);
    }
  }

  for (const redirect of normalizedRedirects) {
    if (!isLocalRedirect(redirect)) {
      errors.push(`Redirect URL must remain local-only: ${stripTrailingSlash(redirect)}.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function normalizeComparableUrl(value: string): string {
  try {
    const parsed = new URL(value.trim());
    parsed.hash = '';
    parsed.search = '';
    return stripTrailingSlash(parsed.toString());
  } catch {
    return '';
  }
}

function isLocalRedirect(value: string): boolean {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:') {
      return false;
    }

    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
