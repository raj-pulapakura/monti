'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getRequiredSupabasePublicEnv } from './env';

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getRequiredSupabasePublicEnv();

  return createBrowserClient(url, anonKey);
}
