import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublicEnv } from './env';

export function createSupabaseProxyClient(request: NextRequest): {
  response: NextResponse;
  supabase:
    | ReturnType<typeof createServerClient>
    | null;
} {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const env = getSupabasePublicEnv();
  if (!env) {
    return {
      response,
      supabase: null,
    };
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  return {
    response,
    supabase,
  };
}
