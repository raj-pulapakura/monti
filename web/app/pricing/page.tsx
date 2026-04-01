'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { BillingMeResponse } from '@/lib/api/billing-me';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type PricingState = 'loading' | 'signed-out' | 'free' | 'paid';

type RedirectResponse = {
  ok: true;
  data: {
    url?: string;
    checkoutUrl?: string;
    portalUrl?: string;
  };
};

export default function PricingPage() {
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [state, setState] = useState<PricingState>('loading');
  const [busyAction, setBusyAction] = useState<'upgrade' | 'portal' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setState('signed-out');
      return;
    }
    const supabaseClient = supabase;

    async function resolveStateFromSession() {
      setState('loading');
      const { data, error } = await supabaseClient.auth.getSession();
      if (cancelled) {
        return;
      }
      if (error) {
        setErrorMessage(error.message);
        setState('signed-out');
        return;
      }

      const token = data.session?.access_token ?? null;
      setAccessToken(token);
      if (!token) {
        setState('signed-out');
        return;
      }

      try {
        const response = await createAuthenticatedApiClient(token).getJson<BillingMeResponse>(
          '/api/billing/me',
        );
        if (!cancelled) {
          setState(response.data.plan === 'paid' ? 'paid' : 'free');
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(toErrorMessage(error));
          setState('free');
        }
      }
    }

    void resolveStateFromSession();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);
      if (!token) {
        setState('signed-out');
        return;
      }
      void createAuthenticatedApiClient(token)
        .getJson<BillingMeResponse>('/api/billing/me')
        .then((response) => {
          setState(response.data.plan === 'paid' ? 'paid' : 'free');
        })
        .catch((error: unknown) => {
          setErrorMessage(toErrorMessage(error));
          setState('free');
        });
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleUpgrade() {
    if (!accessToken || busyAction) {
      return;
    }
    setBusyAction('upgrade');
    setErrorMessage(null);

    try {
      const response = await createAuthenticatedApiClient(accessToken).postJson<RedirectResponse>(
        '/api/billing/checkout/subscription',
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

  async function handlePortal() {
    if (!accessToken || busyAction) {
      return;
    }
    setBusyAction('portal');
    setErrorMessage(null);

    try {
      const response = await createAuthenticatedApiClient(accessToken).postJson<RedirectResponse>(
        '/api/billing/portal',
        { returnUrl: `${window.location.origin}/pricing` },
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

  return (
    <main className="pricing-shell">
      <section className="pricing-hero">
        <p className="landing-kicker">Pricing</p>
        <h1>Clear numbers. No surprises.</h1>
        <p>
          Start free, upgrade when you are ready, and only spend credits when a generation succeeds.
        </p>
      </section>

      <section className="pricing-grid" aria-label="Pricing plans">
        <article className="pricing-plan">
          <h2>Free</h2>
          <p className="pricing-plan-price">$0/month</p>
          <ul>
            <li>15 credits/month</li>
            <li>Fast generation: 1 credit</li>
            <li>Quality generation: 5 credits</li>
          </ul>
          {state === 'loading' ? (
            <span className="pricing-cta-skeleton" aria-hidden="true" />
          ) : (
            <Link href="/auth/sign-up" className="landing-secondary">
              Get started free
            </Link>
          )}
        </article>

        <article className="pricing-plan is-featured">
          <h2>Paid</h2>
          <p className="pricing-plan-price">$10/month</p>
          <ul>
            <li>150 credits/month</li>
            <li>Fast generation: 1 credit</li>
            <li>Quality generation: 5 credits</li>
            <li>Top-up: 50 credits for $4</li>
          </ul>

          {state === 'loading' ? (
            <span className="pricing-cta-skeleton" aria-hidden="true" />
          ) : null}

          {state === 'signed-out' ? (
            <Link href="/auth/sign-up?next=/checkout/start" className="landing-primary">
              Choose paid plan
            </Link>
          ) : null}

          {state === 'free' ? (
            <button
              type="button"
              className="landing-primary"
              onClick={() => void handleUpgrade()}
              disabled={busyAction !== null}
            >
              {busyAction === 'upgrade' ? 'Opening checkout...' : 'Upgrade to paid plan'}
            </button>
          ) : null}

          {state === 'paid' ? (
            <button
              type="button"
              className="landing-secondary"
              onClick={() => void handlePortal()}
              disabled={busyAction !== null}
            >
              {busyAction === 'portal' ? 'Opening portal...' : 'Manage subscription'}
            </button>
          ) : null}
        </article>
      </section>

      <section className="pricing-explainer">
        <h2>What counts as a credit?</h2>
        <ul>
          <li>Fast generation uses 1 credit.</li>
          <li>Quality generation uses 5 credits.</li>
          <li>Failed or cancelled runs cost 0 credits.</li>
        </ul>
      </section>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'We hit a snag. Please try again.';
}
