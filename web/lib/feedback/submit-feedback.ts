import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';

export type FeedbackPayload = {
  kind: 'general' | 'thumbs_up' | 'thumbs_down';
  message: string | null;
  thread_id?: string;
  message_id?: string;
  experience_id?: string;
};

export async function submitFeedback(
  accessToken: string,
  payload: FeedbackPayload,
): Promise<void> {
  await createAuthenticatedApiClient(accessToken).postJson<{ ok: true }>(
    '/api/feedback',
    payload,
  );
}
