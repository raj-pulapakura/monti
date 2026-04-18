'use client';

import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { ProfileContextPicker, ProfileRoleGrid } from '@/app/components/user-profile-selectors';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { UserProfileGetResponse } from '@/lib/api/user-profile';
import { toErrorMessage } from '@/lib/errors';
import type { UserProfileContext, UserProfileRole } from '@/lib/user-profile-options';

function OnboardingMontiBrand() {
  return (
    <div className="onboarding-page-logo-wrap">
      <div
        className="app-topbar-logo onboarding-page-logo"
        role="img"
        aria-label="Monti"
      >
        <span className="app-topbar-logo-mark" aria-hidden="true">
          <span className="app-topbar-logo-tile" />
          <span className="app-topbar-logo-tile app-topbar-logo-tile--tr" />
          <span className="app-topbar-logo-tile app-topbar-logo-tile--bl" />
          <span className="app-topbar-logo-tile" />
        </span>
        <span className="app-topbar-logo-text">monti</span>
      </div>
    </div>
  );
}

export function OnboardingScreen(input: {
  accessToken: string;
  onCompleted: () => void | Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<UserProfileRole | null>(null);
  const [roleOtherText, setRoleOtherText] = useState('');
  const [context, setContext] = useState<UserProfileContext | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveProfile(nextContext: UserProfileContext) {
    if (!role) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const client = createAuthenticatedApiClient(input.accessToken);
      await client.patchJson<UserProfileGetResponse>('/api/profile', {
        role,
        context: nextContext,
        roleOtherText: role === 'other' ? roleOtherText.trim() || null : null,
      });
      await input.onCompleted();
    } catch (error) {
      setSaveError(toErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function handleContextChange(next: UserProfileContext | null) {
    setContext(next);
  }

  function handleTryAgain() {
    if (!context) {
      return;
    }
    void saveProfile(context);
  }

  function handleFinish() {
    if (!role || !context) {
      return;
    }
    void saveProfile(context);
  }

  function goNextFromStep1() {
    if (!role) {
      return;
    }
    setContext(null);
    setSaveError(null);
    setStep(2);
  }

  return (
    <main className="onboarding-page" role="main" aria-labelledby="onboarding-page-title">
      <div className="onboarding-page-body">
        <div className="onboarding-page-panel">
          <OnboardingMontiBrand />
          <h1 id="onboarding-page-title" className="onboarding-page-title">
            {step === 1 ? 'What best describes you?' : 'Where will you use Monti?'}
          </h1>

          {step === 1 ? (
            <>
              <ProfileRoleGrid
                name="onboarding-role"
                value={role}
                onChange={setRole}
                disabled={saving}
              />
              {role === 'other' ? (
                <label className="onboarding-other-label">
                  <span className="onboarding-other-caption">Tell us more (optional)</span>
                  <textarea
                    className="onboarding-other-input"
                    rows={3}
                    value={roleOtherText}
                    onChange={(event) => setRoleOtherText(event.target.value)}
                    disabled={saving}
                    placeholder="e.g. instructional designer, administrator…"
                  />
                </label>
              ) : null}
              <div className="onboarding-page-actions">
                <button
                  type="button"
                  className="settings-btn settings-btn--primary"
                  disabled={!role || saving}
                  onClick={goNextFromStep1}
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              <ProfileContextPicker
                name="onboarding-context"
                value={context}
                onChange={handleContextChange}
                disabled={saving}
              />
              <div className="onboarding-page-actions onboarding-page-actions--split">
                <button
                  type="button"
                  className="settings-btn settings-btn--ghost"
                  disabled={saving}
                  onClick={() => {
                    setSaveError(null);
                    setStep(1);
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={`settings-btn settings-btn--primary onboarding-finish-btn${saving ? ' is-busy' : ''}`}
                  disabled={saving || !context}
                  aria-busy={saving}
                  aria-label={saving ? 'Saving profile' : undefined}
                  onClick={() => void handleFinish()}
                >
                  {saving ? (
                    <LoaderCircle
                      className="composer-spinner"
                      size={18}
                      strokeWidth={2.4}
                      aria-hidden
                    />
                  ) : (
                    'Finish'
                  )}
                </button>
              </div>
              {saveError ? (
                <div className="onboarding-save-error" role="alert">
                  <p>{saveError}</p>
                  <button
                    type="button"
                    className="settings-btn settings-btn--primary"
                    disabled={saving || !context}
                    onClick={() => void handleTryAgain()}
                  >
                    Try again
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
