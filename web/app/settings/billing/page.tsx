'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { BillingMeResponse } from '@/lib/api/billing-me';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { toErrorMessage } from '@/lib/errors';
import type { RedirectResponse } from '@/lib/api/types';

type BillingViewState = 'auth-loading' | 'loading' | 'ready' | 'error';

export default function SettingsBillingPage() {
  const router = useRouter();
  const getSupabaseClient = useSupabaseClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [billingData, setBillingData] = useState<BillingMeResponse['data'] | null>(null);
  const [viewState, setViewState] = useState<BillingViewState>('auth-loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'upgrade' | 'manage' | 'topup' | null>(null);

  const spendableTotal = useMemo(() => {
    if (!billingData?.billingEnabled) {
      return null;
    }
    return billingData.totalSpendableCredits != null
      ? billingData.totalSpendableCredits
      : (billingData.includedCreditsAvailable ?? 0) + (billingData.topupCreditsAvailable ?? 0);
  }, [billingData]);

  const approxGenerations = useMemo(() => {
    if (!billingData?.billingEnabled || spendableTotal == null) {
      return null;
    }
    const fast = billingData.costs.fastCredits;
    const quality = billingData.costs.qualityCredits;
    if (fast == null || fast <= 0 || quality == null || quality <= 0) {
      return null;
    }
    return {
      fast: Math.floor(spendableTotal / fast),
      quality: Math.floor(spendableTotal / quality),
    };
  }, [billingData, spendableTotal]);

  useEffect(() => {
    let cancelled = false;
    const { client: supabase } = getSupabaseClient();
    if (!supabase) {
      router.replace('/sign-in?next=/settings/billing');
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
        router.replace('/sign-in?next=/settings/billing');
        return;
      }

      const token = data.session?.access_token ?? null;
      if (!token) {
        router.replace('/sign-in?next=/settings/billing');
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
        router.replace('/sign-in?next=/settings/billing');
        return;
      }
      void loadBillingSummary(token);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getSupabaseClient identity changes each render
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

  async function openPortal() {
    if (!accessToken || busyAction) {
      return;
    }
    setBusyAction('manage');
    setErrorMessage(null);

    try {
      const response = await createAuthenticatedApiClient(accessToken).postJson<RedirectResponse>(
        '/api/billing/portal',
        { returnUrl: `${window.location.origin}/settings/billing` },
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
    <main className="settings-subpage settings-billing">
      <header className="settings-billing-header">
        <h1 className="settings-billing-title">Billing</h1>
      </header>

      {viewState === 'auth-loading' || viewState === 'loading' ? (
        <div className="settings-billing-skeleton-block" aria-hidden="true">
          <div className="settings-billing-section">
            <div className="settings-billing-row">
              <span className="settings-billing-skeleton" style={{ width: '12rem', height: '2.5rem' }} />
              <span className="settings-billing-skeleton" style={{ width: '6rem', height: '2.25rem' }} />
            </div>
            <p className="settings-billing-skeleton" style={{ width: 'min(100%, 22rem)', height: '1rem' }} />
          </div>
          <div className="settings-billing-section">
            <div className="settings-billing-credit-grid">
              <div className="settings-billing-credit-cell">
                <span className="settings-billing-skeleton" style={{ width: '4rem', height: '2rem' }} />
                <span className="settings-billing-skeleton" style={{ width: '8rem', height: '0.85rem' }} />
              </div>
              <div className="settings-billing-credit-cell">
                <span className="settings-billing-skeleton" style={{ width: '4rem', height: '2rem' }} />
                <span className="settings-billing-skeleton" style={{ width: '8rem', height: '0.85rem' }} />
              </div>
              <div className="settings-billing-credit-cell">
                <span className="settings-billing-skeleton" style={{ width: '4rem', height: '2rem' }} />
                <span className="settings-billing-skeleton" style={{ width: '8rem', height: '0.85rem' }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewState === 'error' ? (
        <div className="settings-billing-section">
          <p className="settings-billing-muted">Could not load billing details.</p>
          <button type="button" className="settings-btn settings-btn--ghost" onClick={() => void handleRetryLoad()}>
            Retry
          </button>
        </div>
      ) : null}

      {billingData && viewState === 'ready' ? (
        <>
          {!billingData.billingEnabled ? (
            <div className="settings-billing-section settings-billing-callout" role="status">
              <h2 className="settings-billing-section-title">Billing unavailable</h2>
              <p className="settings-billing-muted">
                Monetization is not enabled in this environment. When billing is on, your plan and credit balances
                will appear here.
              </p>
            </div>
          ) : null}

          {billingData.billingEnabled ? (
            <>
              <section className="settings-billing-section">
                <div className="settings-billing-row settings-billing-row--plan">
                  <div className="settings-billing-plan-copy">
                    <h2 className="settings-billing-plan-name">
                      {billingData.plan === 'paid' ? 'Paid plan' : 'Free plan'}
                    </h2>
                    <p className="settings-billing-plan-meta">
                      {billingData.plan === 'paid'
                        ? renewalCopy(billingData)
                        : `Included credits refresh on ${formatDate(billingData.nextIncludedRefreshAt)}.`}
                    </p>
                    {billingData.plan === 'paid' && billingData.subscription?.cancelAtPeriodEnd ? (
                      <p className="settings-billing-plan-warn">
                        Subscription ends {formatDate(billingData.subscription.currentPeriodEnd ?? billingData.paidPeriodEndsAt)}.
                        You will move to the free plan unless you resubscribe.
                      </p>
                    ) : null}
                    {billingData.plan === 'paid' && billingData.subscription && !billingData.subscription.cancelAtPeriodEnd ? (
                      <p className="settings-billing-plan-subtle">
                        Status: {formatSubscriptionStatus(billingData.subscription.status)}
                      </p>
                    ) : null}
                  </div>
                  <div className="settings-billing-row-actions">
                    {billingData.plan === 'paid' ? (
                      <>
                        <button
                          type="button"
                          className="settings-btn settings-btn--primary"
                          onClick={() => void openCheckout('topup')}
                          disabled={busyAction !== null}
                        >
                          {busyAction === 'topup' ? 'Opening…' : 'Buy top-up credits'}
                        </button>
                        <button
                          type="button"
                          className="settings-btn settings-btn--ghost"
                          onClick={() => void openPortal()}
                          disabled={busyAction !== null}
                        >
                          {busyAction === 'manage' ? 'Opening…' : 'Manage subscription'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="settings-btn settings-btn--primary"
                        onClick={() => void openCheckout('upgrade')}
                        disabled={busyAction !== null}
                      >
                        {busyAction === 'upgrade' ? 'Opening…' : 'Upgrade to paid'}
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <section className="settings-billing-section">
                <h2 className="settings-billing-section-title">Credits</h2>
                <p className="settings-billing-section-desc">
                  Credits are shared across Fast and Quality modes; each generation spends credits based on the mode
                  you choose.
                </p>
                {approxGenerations ? (
                  <p className="settings-billing-hint">
                    About <strong>{approxGenerations.fast}</strong> Fast or <strong>{approxGenerations.quality}</strong>{' '}
                    Quality generations left at current rates (estimate).
                  </p>
                ) : null}

                <div className="settings-billing-credit-grid">
                  <div className="settings-billing-credit-cell is-emphasis">
                    <span className="settings-billing-credit-value">
                      {billingData.totalSpendableCredits != null
                        ? billingData.totalSpendableCredits
                        : (billingData.includedCreditsAvailable ?? 0) + (billingData.topupCreditsAvailable ?? 0)}
                    </span>
                    <span className="settings-billing-credit-label">Available credits</span>
                    <span className="settings-billing-credit-sublabel">
                      Total you can spend now (included, top-ups, and any manual credits).
                    </span>
                  </div>
                  <div className="settings-billing-credit-cell">
                    <span className="settings-billing-credit-value">{billingData.includedCreditsAvailable ?? 0}</span>
                    <span className="settings-billing-credit-label">
                      Included credits
                      {billingData.includedCreditsTotal != null && billingData.includedCreditsTotal > 0
                        ? ` of ${billingData.includedCreditsTotal} this cycle`
                        : ''}
                    </span>
                    {billingData.includedCreditsTotal != null && billingData.includedCreditsTotal > 0 ? (
                      <div className="settings-billing-progress">
                        <div
                          className="settings-billing-progress-fill is-primary"
                          style={{
                            width: `${pct(billingData.includedCreditsAvailable ?? 0, billingData.includedCreditsTotal)}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="settings-billing-credit-cell">
                    <span className="settings-billing-credit-value">{billingData.topupCreditsAvailable ?? 0}</span>
                    <span className="settings-billing-credit-label">
                      Top-up credits
                      {billingData.topupCreditsTotal != null && billingData.topupCreditsTotal > 0
                        ? ` purchased (${billingData.topupCreditsTotal} total)`
                        : ''}
                    </span>
                    {billingData.topupCreditsTotal != null && billingData.topupCreditsTotal > 0 ? (
                      <div className="settings-billing-progress">
                        <div
                          className="settings-billing-progress-fill"
                          style={{
                            width: `${pct(billingData.topupCreditsAvailable ?? 0, billingData.topupCreditsTotal)}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                {billingData.reservedCreditsTotal != null && billingData.reservedCreditsTotal > 0 ? (
                  <div className="settings-billing-inline-stat">
                    <span className="settings-billing-inline-label">Reserved for in-flight work</span>
                    <span className="settings-billing-inline-value">{billingData.reservedCreditsTotal}</span>
                  </div>
                ) : null}
              </section>

              <section className="settings-billing-section">
                <h2 className="settings-billing-section-title">Generation cost</h2>
                <ul className="settings-billing-cost-list">
                  <li>
                    <span>Fast mode</span>
                    <span>{billingData.costs.fastCredits ?? '—'} credits</span>
                  </li>
                  <li>
                    <span>Quality mode</span>
                    <span>{billingData.costs.qualityCredits ?? '—'} credits</span>
                  </li>
                </ul>
              </section>

              <section className="settings-billing-faq" aria-labelledby="billing-faq-heading">
                <h2 id="billing-faq-heading" className="settings-billing-faq-heading">
                  Common questions
                </h2>
                <div className="settings-billing-faq-list">
                  <details className="settings-billing-faq-item">
                    <summary>How do credits work?</summary>
                    <p>
                      Each time you generate an experience, we reserve credits before the run and settle them when the
                      run finishes. Fast and Quality modes cost different amounts; your balances shown here are the
                      credits you can still spend.
                    </p>
                  </details>
                  <details className="settings-billing-faq-item">
                    <summary>What happens when my paid period ends?</summary>
                    <p>
                      Your included monthly credits from the paid plan are tied to an active subscription. If you cancel
                      or your subscription lapses, you keep any unused top-up credits while your account remains in good
                      standing, and you fall back to the free tier limits for included credits.
                    </p>
                  </details>
                  <details className="settings-billing-faq-item">
                    <summary>Why do I see &ldquo;reserved&rdquo; credits?</summary>
                    <p>
                      While a generation is running, credits are held so concurrent requests cannot overspend. If a run
                      fails, reserved credits are released back to your balance.
                    </p>
                  </details>
                  <details className="settings-billing-faq-item">
                    <summary>Where can I change my card or get a receipt?</summary>
                    <p>
                      On a paid plan, use <strong>Manage subscription</strong> above to open the Stripe customer portal
                      for payment methods and invoices.
                    </p>
                  </details>
                </div>
              </section>
            </>
          ) : null}
        </>
      ) : null}

      {errorMessage ? <p className="settings-billing-error-banner">{errorMessage}</p> : null}
    </main>
  );
}

function pct(available: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((available / total) * 100));
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

function renewalCopy(data: BillingMeResponse['data']): string {
  const end = data.subscription?.currentPeriodEnd ?? data.paidPeriodEndsAt;
  if (data.subscription?.cancelAtPeriodEnd && end) {
    return `Access through ${formatDate(end)} (subscription will not renew).`;
  }
  if (end) {
    return `Your subscription renews on ${formatDate(end)}.`;
  }
  return 'Paid plan active.';
}

function formatSubscriptionStatus(raw: string): string {
  const s = raw.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

