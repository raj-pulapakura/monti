'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { BillingMeResponse } from '@/lib/api/billing-me';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type RedirectResponse = {
  ok: true;
  data: {
    url?: string;
    checkoutUrl?: string;
    portalUrl?: string;
  };
};

type BillingViewState = 'auth-loading' | 'loading' | 'ready' | 'error';

export default function BillingPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [billingData, setBillingData] = useState<BillingMeResponse['data'] | null>(null);
  const [viewState, setViewState] = useState<BillingViewState>('auth-loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'upgrade' | 'manage' | 'topup' | 'invoice' | null>(null);

  function getSupabaseClient() {
    if (supabaseRef.current) {
      return supabaseRef.current;
    }

    try {
      supabaseRef.current = createSupabaseBrowserClient();
      return supabaseRef.current;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();
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
        <section className="pricing-hero">
          <p className="landing-kicker">Billing</p>
          <h1>Loading your billing workspace...</h1>
        </section>
        <section className="pricing-grid" aria-hidden="true">
          <article className="pricing-plan">
            <span className="pricing-cta-skeleton" />
          </article>
          <article className="pricing-plan">
            <span className="pricing-cta-skeleton" />
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="pricing-shell">
      <section className="pricing-hero">
        <p className="landing-kicker">Billing</p>
        <h1>Manage your plan and credits</h1>
        <p>Track available credits, view current costs, and take billing actions in one place.</p>
      </section>

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
        <section className="pricing-grid" aria-label="Billing details">
          <article className="pricing-plan">
            <h2>{billingData.plan === 'paid' ? 'Paid plan' : 'Free plan'}</h2>
            <p className="pricing-plan-price">
              {billingData.plan === 'paid'
                ? `Period ends ${formatDate(billingData.paidPeriodEndsAt)}`
                : `Refreshes ${formatDate(billingData.nextIncludedRefreshAt)}`}
            </p>
            {billingData.plan === 'paid' ? (
              <button
                type="button"
                className="landing-secondary"
                onClick={() => void openPortal('manage')}
                disabled={busyAction !== null}
              >
                {busyAction === 'manage' ? 'Opening portal...' : 'Manage subscription'}
              </button>
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
          </article>

          <article className="pricing-plan">
            <h2>Credits</h2>
            <ul>
              <li>Included available: {billingData.includedCreditsAvailable ?? 0}</li>
              <li>Top-up available: {billingData.topupCreditsAvailable ?? 0}</li>
              <li>Fast mode cost: {billingData.costs.fastCredits ?? '—'} credits</li>
              <li>Quality mode cost: {billingData.costs.qualityCredits ?? '—'} credits</li>
            </ul>
            {billingData.plan === 'paid' ? (
              <button
                type="button"
                className="landing-primary"
                onClick={() => void openCheckout('topup')}
                disabled={busyAction !== null}
              >
                {busyAction === 'topup' ? 'Opening checkout...' : 'Buy top-up pack'}
              </button>
            ) : null}
            <button
              type="button"
              className="landing-secondary"
              onClick={() => void openPortal('invoice')}
              disabled={busyAction !== null}
            >
              {busyAction === 'invoice' ? 'Opening invoice history...' : 'Invoice history'}
            </button>
          </article>
        </section>
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'We hit a snag. Please try again.';
}
