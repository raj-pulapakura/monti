'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { BillingMeResponse } from '@/lib/api/billing-me';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { toErrorMessage } from '@/lib/errors';
import type { RedirectResponse } from '@/lib/api/types';
import { AppTopbar } from '@/app/components/app-topbar';

type BillingViewState = 'auth-loading' | 'loading' | 'ready' | 'error';

export default function BillingPage() {
  const router = useRouter();
  const getSupabaseClient = useSupabaseClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [billingData, setBillingData] = useState<BillingMeResponse['data'] | null>(null);
  const [viewState, setViewState] = useState<BillingViewState>('auth-loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'upgrade' | 'manage' | 'topup' | 'invoice' | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { client: supabase } = getSupabaseClient();
    if (!supabase) {
      router.replace('/sign-in?next=/billing');
      return;
    }
    const supabaseClient = supabase;

    async function resolveAuthAndBilling() {
      setViewState('auth-loading');
      const { data, error } = await supabaseClient.auth.getSession();
      if (cancelled) {
        return;
      }

      if (error) {
        router.replace('/sign-in?next=/billing');
        return;
      }

      const token = data.session?.access_token ?? null;
      if (!token) {
        router.replace('/sign-in?next=/billing');
        return;
      }

      setAccessToken(token);
      await loadBillingSummary(token);
    }

    async function loadBillingSummary(token: string) {
      setErrorMessage(null);
      setViewState('loading');
      try {
        const response = await createAuthenticatedApiClient(token).getJson<BillingMeResponse>(
          '/api/billing/me',
        );
        if (!cancelled) {
          setBillingData(response.data);
          setViewState('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setBillingData(null);
          setErrorMessage(toErrorMessage(error));
          setViewState('error');
        }
      }
    }

    void resolveAuthAndBilling();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);
      if (!token) {
        router.replace('/sign-in?next=/billing');
        return;
      }
      void loadBillingSummary(token);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [router]);

  async function handleSignOut() {
    const { client: supabaseClient } = getSupabaseClient();
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    router.replace('/');
  }

  async function openCheckout(kind: 'upgrade' | 'topup') {
    if (!accessToken || busyAction) {
      return;
    }
    setBusyAction(kind);
    setErrorMessage(null);

    try {
      const response = await createAuthenticatedApiClient(accessToken).postJson<RedirectResponse>(
        kind === 'upgrade' ? '/api/billing/checkout/subscription' : '/api/billing/checkout/topup',
        {},
      );
      const destination = response.data.checkoutUrl ?? response.data.url;
      if (!destination) {
        throw new Error('No checkout URL returned by the server.');
      }
      window.location.href = destination;
    } catch (error) {
      setBusyAction(null);
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function openPortal(kind: 'manage' | 'invoice') {
    if (!accessToken || busyAction) {
      return;
    }
    setBusyAction(kind);
    setErrorMessage(null);

    try {
      const response = await createAuthenticatedApiClient(accessToken).postJson<RedirectResponse>(
        '/api/billing/portal',
        { returnUrl: `${window.location.origin}/billing` },
      );
      const destination = response.data.portalUrl ?? response.data.url;
      if (!destination) {
        throw new Error('No portal URL returned by the server.');
      }
      window.location.href = destination;
    } catch (error) {
      setBusyAction(null);
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function handleRetryLoad() {
    if (!accessToken || viewState === 'loading') {
      return;
    }
    setViewState('loading');
    setErrorMessage(null);
    try {
      const response = await createAuthenticatedApiClient(accessToken).getJson<BillingMeResponse>(
        '/api/billing/me',
      );
      setBillingData(response.data);
      setViewState('ready');
    } catch (error) {
      setBillingData(null);
      setErrorMessage(toErrorMessage(error));
      setViewState('error');
    }
  }

  return (
    <div className="page-shell">
      <AppTopbar onSignOut={() => void handleSignOut()} />
      <main className="billing-page">
        <div className="billing-page-inner">
          <h1 className="billing-heading">Billing &amp; plan</h1>

          {viewState === 'auth-loading' || viewState === 'loading' ? (
            <div className="billing-body" aria-hidden="true">
              <div className="billing-section">
                <div className="billing-plan-row">
                  <span className="billing-skeleton" style={{ width: '9rem' }} />
                  <span className="billing-skeleton" style={{ width: '7rem' }} />
                </div>
              </div>
              <div className="billing-section">
                <div className="billing-stats">
                  <div className="billing-stat">
                    <span className="billing-skeleton" style={{ width: '3rem', height: '2rem' }} />
                    <span className="billing-skeleton" style={{ width: '6rem', height: '0.85rem' }} />
                  </div>
                  <div className="billing-stat">
                    <span className="billing-skeleton" style={{ width: '3rem', height: '2rem' }} />
                    <span className="billing-skeleton" style={{ width: '6rem', height: '0.85rem' }} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {viewState === 'error' ? (
            <div className="billing-body">
              <p className="billing-error-msg">Could not load billing details.</p>
              <button type="button" className="landing-secondary" onClick={() => void handleRetryLoad()}>
                Retry
              </button>
            </div>
          ) : null}

          {billingData ? (
            <div className="billing-body">
              <div className="billing-section">
                <div className="billing-plan-row">
                  <h2 className="billing-plan-name">
                    {billingData.plan === 'paid' ? 'Paid plan' : 'Free plan'}
                  </h2>
                  <span className="billing-plan-meta">
                    {billingData.plan === 'paid'
                      ? `Period ends ${formatDate(billingData.paidPeriodEndsAt)}`
                      : `Refreshes ${formatDate(billingData.nextIncludedRefreshAt)}`}
                  </span>
                </div>
              </div>

              <div className="billing-section">
                <div className="billing-stats">
                  <div className="billing-stat is-primary">
                    <span className="billing-stat-value">
                      {billingData.includedCreditsAvailable ?? 0}
                    </span>
                    <span className="billing-stat-label">
                      Included credits
                      {billingData.includedCreditsTotal != null
                        ? ` of ${billingData.includedCreditsTotal}`
                        : ''}
                    </span>
                    {billingData.includedCreditsTotal != null && billingData.includedCreditsTotal > 0 ? (
                      <div className="billing-progress">
                        <div
                          className="billing-progress-fill is-primary"
                          style={{
                            width: `${Math.round(((billingData.includedCreditsAvailable ?? 0) / billingData.includedCreditsTotal) * 100)}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="billing-stat">
                    <span className="billing-stat-value">
                      {billingData.topupCreditsAvailable ?? 0}
                    </span>
                    <span className="billing-stat-label">
                      Top-up credits
                      {billingData.topupCreditsTotal != null && billingData.topupCreditsTotal > 0
                        ? ` of ${billingData.topupCreditsTotal}`
                        : ''}
                    </span>
                    {billingData.topupCreditsTotal != null && billingData.topupCreditsTotal > 0 ? (
                      <div className="billing-progress">
                        <div
                          className="billing-progress-fill"
                          style={{
                            width: `${Math.round(((billingData.topupCreditsAvailable ?? 0) / billingData.topupCreditsTotal) * 100)}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  {billingData.reservedCreditsTotal != null && billingData.reservedCreditsTotal > 0 ? (
                    <div className="billing-stat">
                      <span className="billing-stat-value">
                        {billingData.reservedCreditsTotal}
                      </span>
                      <span className="billing-stat-label">Reserved in use</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="billing-section">
                <div className="billing-rate-row">
                  <div className="billing-rate-item">
                    <span className="billing-rate-item-label">Fast mode</span>
                    <span className="billing-rate-item-value">
                      {billingData.costs.fastCredits ?? '—'} credits / generation
                    </span>
                  </div>
                  <div className="billing-rate-item">
                    <span className="billing-rate-item-label">Quality mode</span>
                    <span className="billing-rate-item-value">
                      {billingData.costs.qualityCredits ?? '—'} credits / generation
                    </span>
                  </div>
                </div>
              </div>

              <div className="billing-section billing-actions">
                {billingData.plan === 'paid' ? (
                  <>
                    <button
                      type="button"
                      className="landing-primary"
                      onClick={() => void openCheckout('topup')}
                      disabled={busyAction !== null}
                    >
                      {busyAction === 'topup' ? 'Opening checkout...' : 'Buy top-up pack'}
                    </button>
                    <button
                      type="button"
                      className="landing-secondary"
                      onClick={() => void openPortal('manage')}
                      disabled={busyAction !== null}
                    >
                      {busyAction === 'manage' ? 'Opening portal...' : 'Manage subscription'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="landing-primary"
                    onClick={() => void openCheckout('upgrade')}
                    disabled={busyAction !== null}
                  >
                    {busyAction === 'upgrade' ? 'Opening checkout...' : 'Upgrade to paid plan'}
                  </button>
                )}
                <button
                  type="button"
                  className="billing-text-link"
                  onClick={() => void openPortal('invoice')}
                  disabled={busyAction !== null}
                >
                  {busyAction === 'invoice' ? 'Opening...' : 'Invoice history →'}
                </button>
              </div>
            </div>
          ) : null}

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </div>
      </main>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'soon';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'soon';
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
