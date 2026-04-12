'use client';

import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/app/context/auth-context';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';

function authProviderLabel(user: User): string {
  const primary = user.identities?.[0]?.provider;
  if (primary === 'google') {
    return 'Google';
  }
  if (primary === 'email') {
    return 'Email & password';
  }
  if (primary) {
    return primary.charAt(0).toUpperCase() + primary.slice(1);
  }
  return 'Email & password';
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const getSupabaseClient = useSupabaseClient();
  const { user, loading } = useAuthContext();

  async function handleSignOut() {
    const { client } = getSupabaseClient();
    if (!client) {
      return;
    }
    await client.auth.signOut();
    router.replace('/');
  }

  if (loading || !user) {
    return (
      <div className="settings-subpage settings-account-page" aria-busy="true">
        <p className="settings-hub-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="settings-subpage settings-account-page">
      <header className="settings-account-header">
        <h1 className="settings-account-heading">Account</h1>
      </header>

      <div className="settings-account-fields">
        <div className="settings-account-row">
          <span className="settings-account-row-label">Email</span>
          <span className="settings-account-row-value">{user.email ?? '—'}</span>
        </div>
        <div className="settings-account-row">
          <span className="settings-account-row-label">Sign-in method</span>
          <span className="settings-account-row-value">{authProviderLabel(user)}</span>
        </div>
        <div className="settings-account-row settings-account-row--action">
          <span className="settings-account-row-label">Log out</span>
          <button type="button" className="settings-btn settings-btn--ghost" onClick={() => void handleSignOut()}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
