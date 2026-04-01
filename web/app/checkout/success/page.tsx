'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { BillingMeResponse } from '@/lib/api/billing-me';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type SuccessState = 'polling' | 'confirmed' | 'pending';

export default function CheckoutSuccessPage() {
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [state, setState] = useState<SuccessState>('polling');
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [planName, setPlanName] = useState<'free' | 'paid'>('free');

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
    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function poll(accessToken: string) {
      try {
        const response = await createAuthenticatedApiClient(accessToken).getJson<BillingMeResponse>(
          '/api/billing/me',
        );
        if (stopped) {
          return;
        }
        if (response.data.plan === 'paid') {
          setPlanName('paid');
          setRemainingCredits(response.data.includedCreditsAvailable ?? 0);
          setState('confirmed');
          stopped = true;
          if (intervalId) {
            clearInterval(intervalId);
          }
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      } catch {
        // Keep polling until timeout fallback.
      }
    }

    async function startPolling() {
      const supabase = getSupabaseClient();
      const session = supabase ? await supabase.auth.getSession() : null;
      const accessToken = session?.data.session?.access_token ?? null;
      if (!accessToken) {
        setState('pending');
        return;
      }

      void poll(accessToken);
      intervalId = setInterval(() => {
        void poll(accessToken);
      }, 1500);
      timeoutId = setTimeout(() => {
        if (!stopped) {
          setState('pending');
          stopped = true;
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      }, 10000);
    }

    void startPolling();

    return () => {
      stopped = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <main className="auth-shell checkout-shell">
      <section className="auth-card checkout-card">
        {state === 'polling' ? (
          <>
            <h1>Finalizing your plan</h1>
            <div className="loading-spinner" aria-hidden="true" />
            <p className="auth-copy">We are confirming your subscription and credits now.</p>
          </>
        ) : null}

        {state === 'confirmed' ? (
          <>
            <h1>You are on the {planName} plan</h1>
            <p className="auth-success">
              Subscription active. Remaining included credits: {remainingCredits ?? 0}.
            </p>
          </>
        ) : null}

        {state === 'pending' ? (
          <>
            <h1>Subscription activation in progress</h1>
            <p className="auth-copy">
              Your subscription is activating - credits will be available shortly.
            </p>
          </>
        ) : null}

        <Link href="/" className="landing-secondary">
          Go to workspace
        </Link>
      </section>
    </main>
  );
}
