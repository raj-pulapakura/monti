import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';

type ToggleFavouriteResponse = {
  ok: true;
  data: { isFavourite: boolean };
};

/** PATCH favourite flag for the experience linked to the thread (owner only). */
export async function toggleExperienceFavourite(
  accessToken: string,
  threadId: string,
  isFavourite: boolean,
): Promise<void> {
  await createAuthenticatedApiClient(accessToken).patchJson<ToggleFavouriteResponse>(
    `/api/chat/threads/${threadId}/favourite`,
    { isFavourite },
  );
}
