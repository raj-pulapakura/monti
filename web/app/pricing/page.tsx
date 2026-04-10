'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { BillingMeResponse } from '@/lib/api/billing-me';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { toErrorMessage } from '@/lib/errors';
import type { RedirectResponse } from '@/lib/api/types';

type PricingState = 'loading' | 'signed-out' | 'free' | 'paid';

const FAQ_ITEMS = [
  {
    q: 'What is a credit?',
    a: 'Credits are the unit of usage on Monti. Each generation you run consumes credits depending on the mode — fast or quality. You only spend credits when a generation completes successfully.',
  },
  {
    q: "What's the difference between fast and quality generation?",
    a: 'Fast generation (1 credit) is optimised for speed and iteration. Quality generation (5 credits) takes longer but produces higher-fidelity results — better layout, richer interactions, more polished output.',
  },
  {
    q: 'What happens if a generation fails?',
    a: 'Nothing is charged. Credits are only deducted when a generation succeeds — if a run fails or you cancel it mid-way, you keep your credits.',
  },
  {
    q: 'Can I top up credits on the paid plan?',
    a: 'Yes. Paid plan members can purchase additional credits at any time — 50 credits for $4 — without waiting for their monthly allowance to reset.',
  },
  {
    q: 'Do unused credits roll over?',
    a: 'Credits reset at the start of each billing cycle and do not roll over. Top-up credits, however, remain in your account until used.',
  },
  {
    q: 'Can I cancel at any time?',
    a: "Yes, you can cancel your subscription at any time from the billing portal. You'll retain access to the paid plan until the end of your current billing period.",
  },
];

export default function PricingPage() {
  const getSupabaseClient = useSupabaseClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [state, setState] = useState<PricingState>('loading');
  const [busyAction, setBusyAction] = useState<'upgrade' | 'portal' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { client: supabase } = getSupabaseClient();
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
      <header className="pricing-header">
        <Link href="/" className="landing-header-logo pricing-wordmark">
          Monti
        </Link>
        <h1>Pricing</h1>
        <p>Start free. Upgrade when you&rsquo;re ready.</p>
      </header>

      <section className="pricing-grid" aria-label="Pricing plans">
        <article className="pricing-plan">
          <h2>Free</h2>
          <p className="pricing-plan-tagline">Everything you need to get started</p>
          <div className="pricing-plan-price-block">
            <p className="pricing-plan-price">
              $0 <span>/ month</span>
            </p>
          </div>
          {state === 'loading' ? (
            <span className="pricing-cta-skeleton" aria-hidden="true" />
          ) : (
            <Link href="/sign-up" className="landing-secondary">
              Get started free
            </Link>
          )}
          <div className="pricing-plan-divider" />
          <ul>
            <li>15 credits per month</li>
            <li>Fast generation — 1 credit</li>
            <li>Quality generation — 5 credits</li>
          </ul>
        </article>

        <article className="pricing-plan is-featured">
          <h2>Paid</h2>
          <p className="pricing-plan-tagline">More credits, more power, top-up anytime</p>
          <div className="pricing-plan-price-block">
            <p className="pricing-plan-price">
              $10 <span>/ month</span>
            </p>
          </div>

          {state === 'loading' ? (
            <span className="pricing-cta-skeleton" aria-hidden="true" />
          ) : null}

          {state === 'signed-out' ? (
            <Link href="/sign-up?next=/checkout/start" className="landing-primary">
              Get started
            </Link>
          ) : null}

          {state === 'free' ? (
            <button
              type="button"
              className="landing-primary"
              onClick={() => void handleUpgrade()}
              disabled={busyAction !== null}
            >
              {busyAction === 'upgrade' ? 'Opening checkout...' : 'Upgrade to paid'}
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

          <div className="pricing-plan-divider" />
          <ul>
            <li>150 credits per month</li>
            <li>Fast generation — 1 credit</li>
            <li>Quality generation — 5 credits</li>
            <li>Top-up 50 credits for $4 anytime</li>
          </ul>
        </article>
      </section>

      <section className="pricing-faq" aria-label="Frequently asked questions">
        <h2 className="pricing-faq-heading">FAQ</h2>
        <dl className="pricing-faq-list">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="pricing-faq-item">
              <dt>
                <button
                  type="button"
                  className="pricing-faq-trigger"
                  aria-expanded={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{item.q}</span>
                  <span className="pricing-faq-icon" aria-hidden="true">
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
              </dt>
              {openFaq === i && <dd className="pricing-faq-answer">{item.a}</dd>}
            </div>
          ))}
        </dl>
      </section>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  );
}

