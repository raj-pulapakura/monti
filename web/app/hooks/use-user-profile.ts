'use client';

import { useCallback, useEffect, useState } from 'react';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { UserProfileGetResponse } from '@/lib/api/user-profile';
import { toErrorMessage } from '@/lib/errors';

export type UserProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: UserProfileGetResponse['data'] | null };

export function useUserProfile(accessToken: string | null): {
  state: UserProfileState;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
} {
  const [state, setState] = useState<UserProfileState>(() =>
    accessToken ? { status: 'loading' } : { status: 'idle' },
  );

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!accessToken) {
        setState({ status: 'idle' });
        return;
      }

      if (!options?.silent) {
        setState({ status: 'loading' });
      }

      try {
        const client = createAuthenticatedApiClient(accessToken);
        const body = await client.getJsonOrNotFound<UserProfileGetResponse>(
          '/api/profile',
        );
        setState({
          status: 'ready',
          profile: body?.data ?? null,
        });
      } catch (error) {
        setState({ status: 'error', message: toErrorMessage(error) });
      }
    },
    [accessToken],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { state, refresh: load };
}
