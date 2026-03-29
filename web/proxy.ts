import { NextResponse, type NextRequest } from 'next/server';
import { resolveAuthRouteRedirect } from '@/lib/auth/route-access';
import { resolveRequestOrigin } from '@/lib/http/request-origin';
import { createSupabaseProxyClient } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
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
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/', '/chat/:path*', '/auth', '/auth/:path*'],
};
