'use client';

import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuthContext } from '@/app/context/auth-context';
import { ProfileContextPicker, ProfileRoleGrid } from '@/app/components/user-profile-selectors';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { useUserProfile } from '@/app/hooks/use-user-profile';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { UserProfileGetResponse } from '@/lib/api/user-profile';
import { toErrorMessage } from '@/lib/errors';
import type { UserProfileContext, UserProfileRole } from '@/lib/user-profile-options';
import { labelForContext, labelForRole } from '@/lib/user-profile-options';
import { isUserOnboardingEnabled } from '@/lib/user-onboarding-flag';

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
  const { user, session, loading } = useAuthContext();
  const accessToken = session?.access_token ?? null;
  const { state: profileState, refresh: refreshProfile } = useUserProfile(accessToken);

  const [editingProfile, setEditingProfile] = useState(false);
  const [draftRole, setDraftRole] = useState<UserProfileRole | null>(null);
  const [draftContext, setDraftContext] = useState<UserProfileContext | null>(null);
  const [draftRoleOther, setDraftRoleOther] = useState('');
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSignOut() {
    const { client } = getSupabaseClient();
    if (!client) {
      return;
    }
    await client.auth.signOut();
    router.replace('/');
  }

  async function handleProfileSave() {
    if (!accessToken || draftRole === null || draftContext === null) {
      return;
    }
    setSavePending(true);
    setSaveError(null);
    try {
      const client = createAuthenticatedApiClient(accessToken);
      await client.patchJson<UserProfileGetResponse>('/api/profile', {
        role: draftRole,
        context: draftContext,
        roleOtherText: draftRole === 'other' ? draftRoleOther.trim() || null : null,
      });
      await refreshProfile({ silent: true });
      setEditingProfile(false);
    } catch (error) {
      setSaveError(toErrorMessage(error));
    } finally {
      setSavePending(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="settings-subpage settings-account-page" aria-busy="true">
        <p className="settings-hub-loading">Loading…</p>
      </div>
    );
  }

  const profileReady = profileState.status === 'ready';
  const profile = profileReady ? profileState.profile : null;
  const profileIncomplete =
    profile && profile.onboardingCompletedAt === null;
  const userOnboardingEnabled = isUserOnboardingEnabled();

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

      <section className="settings-profile-section" aria-labelledby="settings-profile-heading">
        <h2 id="settings-profile-heading" className="settings-profile-heading">
          Learning profile
        </h2>

        {profileState.status === 'loading' || profileState.status === 'idle' ? (
          <p className="settings-hub-loading">Loading profile…</p>
        ) : null}

        {profileState.status === 'error' ? (
          <div>
            <p className="error-banner" role="status">
              {profileState.message}
            </p>
            <div className="settings-profile-actions">
              <button
                type="button"
                className="settings-btn settings-btn--primary"
                onClick={() => void refreshProfile()}
              >
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {profileReady && userOnboardingEnabled && !profile ? (
          <div>
            <p className="settings-profile-banner" role="status">
              Complete your profile — tell us your role and context so Monti can tailor responses.
              You will be prompted when you open the home screen.
            </p>
            <Link href="/" className="settings-btn settings-btn--primary">
              Go to home
            </Link>
          </div>
        ) : null}

        {profileReady && !userOnboardingEnabled && !profile && !editingProfile ? (
          <div>
            <p className="settings-profile-banner" role="status">
              Optionally add your role and where you use Monti so responses can be tailored. You can
              change this anytime here in settings.
            </p>
            <button
              type="button"
              className="settings-btn settings-btn--primary"
              onClick={() => {
                setDraftRole(null);
                setDraftContext(null);
                setDraftRoleOther('');
                setSaveError(null);
                setEditingProfile(true);
              }}
            >
              Add learning profile
            </button>
          </div>
        ) : null}

        {profileReady &&
        (profile || (!userOnboardingEnabled && !profile && editingProfile)) ? (
          <>
            {profile && profileIncomplete && userOnboardingEnabled ? (
              <p className="settings-profile-banner" role="status">
                Complete your profile to unlock the full workspace and personalized guidance.
              </p>
            ) : null}

            {profile && !editingProfile ? (
              <>
                <div className="settings-account-row">
                  <span className="settings-account-row-label">Role</span>
                  <span className="settings-account-row-value">{labelForRole(profile.role)}</span>
                </div>
                <div className="settings-account-row">
                  <span className="settings-account-row-label">Context</span>
                  <span className="settings-account-row-value">{labelForContext(profile.context)}</span>
                </div>
                <div className="settings-profile-actions">
                  <button
                    type="button"
                    className="settings-btn settings-btn--ghost"
                    onClick={() => {
                      if (profileState.status !== 'ready' || !profileState.profile) {
                        return;
                      }
                      const row = profileState.profile;
                      setDraftRole(row.role);
                      setDraftContext(row.context);
                      setDraftRoleOther(row.roleOtherText ?? '');
                      setSaveError(null);
                      setEditingProfile(true);
                    }}
                  >
                    Edit
                  </button>
                </div>
              </>
            ) : null}

            {((!profile && !userOnboardingEnabled && editingProfile) ||
              (profile && editingProfile)) ? (
              <>
                <ProfileRoleGrid
                  name="settings-role"
                  value={draftRole}
                  onChange={setDraftRole}
                  disabled={savePending}
                />
                {draftRole === 'other' ? (
                  <div className="settings-profile-other">
                    <label className="onboarding-other-label" htmlFor="settings-role-other">
                      <span className="onboarding-other-caption">Describe your role (optional)</span>
                      <textarea
                        id="settings-role-other"
                        value={draftRoleOther}
                        onChange={(event) => setDraftRoleOther(event.target.value)}
                        disabled={savePending}
                      />
                    </label>
                  </div>
                ) : null}
                <div style={{ marginTop: '1rem' }}>
                  <ProfileContextPicker
                    name="settings-context"
                    value={draftContext}
                    onChange={setDraftContext}
                    disabled={savePending}
                  />
                </div>
                {saveError ? (
                  <p className="error-banner" role="status">
                    {saveError}
                  </p>
                ) : null}
                <div className="settings-profile-actions">
                  <button
                    type="button"
                    className="settings-btn settings-btn--primary"
                    disabled={
                      savePending || draftRole === null || draftContext === null
                    }
                    onClick={() => void handleProfileSave()}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="settings-btn settings-btn--ghost"
                    disabled={savePending}
                    onClick={() => {
                      setEditingProfile(false);
                      setSaveError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
