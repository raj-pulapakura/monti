import { NextResponse } from 'next/server';
import { resolveSafeNextPath } from '@/lib/auth/next-path';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextPath = resolveSafeNextPath(requestUrl.searchParams.get('next'));
  const supabase = await createSupabaseRouteHandlerClient();

  if (!supabase) {
    const redirectUrl = new URL('/auth/sign-in', requestUrl.origin);
    redirectUrl.searchParams.set('error', 'Supabase auth is not configured.');
    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const redirectUrl = new URL('/auth/sign-in', requestUrl.origin);
      redirectUrl.searchParams.set('error', error.message);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
