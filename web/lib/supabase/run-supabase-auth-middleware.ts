import { NextResponse, type NextRequest } from 'next/server';
import { resolveAuthRouteRedirect } from '@/lib/auth/route-access';
import { resolveRequestOrigin } from '@/lib/http/request-origin';
import { createSupabaseProxyClient } from '@/lib/supabase/proxy';

function mergeRefreshedCookies(from: NextResponse, to: NextResponse) {
  const setCookies = from.headers.getSetCookie?.();
  if (setCookies?.length) {
    for (const cookie of setCookies) {
      to.headers.append('set-cookie', cookie);
    }
    return;
  }

  for (const { name, value } of from.cookies.getAll()) {
    to.cookies.set(name, value);
  }
}

export async function runSupabaseAuthMiddleware(
  request: NextRequest,
): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  const { response, supabase } = createSupabaseProxyClient(request);
  if (!supabase) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectTarget = resolveAuthRouteRedirect({
    pathname,
    search: request.nextUrl.search,
    hasUser: Boolean(user),
  });

  if (redirectTarget) {
    const redirectUrl = new URL(redirectTarget, resolveRequestOrigin(request));
    const redirectResponse = NextResponse.redirect(redirectUrl);
    mergeRefreshedCookies(response, redirectResponse);
    return redirectResponse;
  }

  return response;
}
