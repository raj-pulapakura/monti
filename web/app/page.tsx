import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { RootPageClient } from './root-page-client';

export default async function Page() {
  const supabase = await createSupabaseRouteHandlerClient();
  if (!supabase) {
    return (
      <RootPageClient initialAccessToken={null} initialUserId={null} />
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return (
      <RootPageClient initialAccessToken={null} initialUserId={null} />
    );
  }

  if (!user) {
    return (
      <RootPageClient initialAccessToken={null} initialUserId={null} />
    );
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return (
      <RootPageClient initialAccessToken={null} initialUserId={null} />
    );
  }

  const accessToken = session?.access_token ?? null;
  if (!accessToken) {
    return (
      <RootPageClient initialAccessToken={null} initialUserId={null} />
    );
  }

  return (
    <RootPageClient
      initialAccessToken={accessToken}
      initialUserId={user.id}
    />
  );
}
