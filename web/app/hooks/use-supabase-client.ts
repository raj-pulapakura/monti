'use client';

import { useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function useSupabaseClient() {
  const clientRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  function getClient(): { client: ReturnType<typeof createSupabaseBrowserClient>; error: null } | { client: null; error: string } {
    if (clientRef.current) {
      return { client: clientRef.current, error: null };
    }

    try {
      clientRef.current = createSupabaseBrowserClient();
      return { client: clientRef.current, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Supabase is not configured in this environment.';
      return { client: null, error: message };
    }
  }

  return getClient;
}
