'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { BillingMeResponse } from '@/lib/api/billing-me';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { toErrorMessage } from '@/lib/errors';
import type { RedirectResponse } from '@/lib/api/types';

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
      router.replace('/auth/sign-in?next=/billing');
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
        router.replace('/auth/sign-in?next=/billing');
        return;
      }

      const token = data.session?.access_token ?? null;
      if (!token) {
        router.replace('/auth/sign-in?next=/billing');
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
        router.replace('/auth/sign-in?next=/billing');
        return;
      }
      void loadBillingSummary(token);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [router]);

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

  if (viewState === 'auth-loading' || viewState === 'loading') {
    return (
      <main className="pricing-shell">
        <h1 className="billing-heading">Billing</h1>
        <div className="billing-card" aria-hidden="true">
          <div className="billing-plan-row">
            <span className="pricing-cta-skeleton" />
          </div>
          <hr className="billing-divider" />
          <div className="billing-stats">
            <div className="billing-stat is-primary">
              <span className="pricing-cta-skeleton" />
            </div>
            <div className="billing-stat">
              <span className="pricing-cta-skeleton" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pricing-shell">
      <h1 className="billing-heading">Billing</h1>

      {viewState === 'error' ? (
        <section className="pricing-explainer">
          <h2>Billing data unavailable</h2>
          <p>We could not load your billing details right now.</p>
          <button type="button" className="landing-secondary" onClick={() => void handleRetryLoad()}>
            Retry
          </button>
        </section>
      ) : null}

      {billingData ? (
        <div className="billing-card" aria-label="Billing details">
          <div className="billing-plan-row">
            <h2>{billingData.plan === 'paid' ? 'Paid plan' : 'Free plan'}</h2>
            <span>
              {billingData.plan === 'paid'
                ? `Period ends ${formatDate(billingData.paidPeriodEndsAt)}`
                : `Refreshes ${formatDate(billingData.nextIncludedRefreshAt)}`}
            </span>
          </div>

          <hr className="billing-divider" />

          <div className="billing-stats">
            <div className="billing-stat is-primary">
              <span className="billing-stat-value">
                {billingData.includedCreditsAvailable ?? 0}
              </span>
              <span className="billing-stat-label">Included available</span>
            </div>
            <div className="billing-stat">
              <span className="billing-stat-value">
                {billingData.topupCreditsAvailable ?? 0}
              </span>
              <span className="billing-stat-label">Top-up available</span>
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

          <hr className="billing-divider" />

          <div className="billing-rate-row">
            <span>Fast mode uses {billingData.costs.fastCredits ?? '—'} credits</span>
            <span>Quality mode uses {billingData.costs.qualityCredits ?? '—'} credits</span>
          </div>

          <hr className="billing-divider" />

          <div className="billing-actions">
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
    </main>
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

