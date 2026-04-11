'use client';

import type { User } from '@supabase/supabase-js';
import { useAuthContext } from '@/app/context/auth-context';

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
  const { user, loading } = useAuthContext();

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
        <p className="settings-account-lead">Your sign-in details (read-only).</p>
      </header>

      <div className="settings-account-fields">
        <label className="settings-readonly-field">
          <span className="settings-readonly-label">Email</span>
          <span className="settings-readonly-value">{user.email ?? '—'}</span>
        </label>
        <label className="settings-readonly-field">
          <span className="settings-readonly-label">Sign-in method</span>
          <span className="settings-readonly-value">{authProviderLabel(user)}</span>
        </label>
      </div>
    </div>
  );
}
