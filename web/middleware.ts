import type { NextRequest } from 'next/server';
import { runSupabaseAuthMiddleware } from '@/lib/supabase/run-supabase-auth-middleware';

export async function middleware(request: NextRequest) {
  return runSupabaseAuthMiddleware(request);
}

export const config = {
  matcher: ['/', '/chat/:path*', '/auth', '/auth/:path*'],
};
