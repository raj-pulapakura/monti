import { NextResponse, type NextRequest } from 'next/server';
import { resolveAuthRouteRedirect } from '@/lib/auth/route-access';
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
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = redirectTarget;
    if (redirectTarget.includes('?')) {
      const [redirectPathname, redirectSearch] = redirectTarget.split('?');
      redirectUrl.pathname = redirectPathname;
      redirectUrl.search = redirectSearch ? `?${redirectSearch}` : '';
    } else {
      redirectUrl.search = '';
    }
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/', '/app/:path*', '/auth', '/auth/:path*'],
};
