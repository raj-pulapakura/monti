'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { BillingMeResponse } from '@/lib/api/billing-me';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { AuthLayout } from '@/app/components/auth-layout';

type SuccessState = 'polling' | 'confirmed' | 'pending';

export default function CheckoutSuccessPage() {
  const getSupabaseClient = useSupabaseClient();
  const [state, setState] = useState<SuccessState>('polling');
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [planName, setPlanName] = useState<'free' | 'paid'>('free');

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
          setRemainingCredits(
            response.data.totalSpendableCredits != null
              ? response.data.totalSpendableCredits
              : response.data.includedCreditsAvailable ?? 0,
          );
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
      const { client: supabase } = getSupabaseClient();
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
    <AuthLayout
      title={
        state === 'polling'
          ? 'Finalizing your plan'
          : state === 'confirmed'
            ? `You are on the ${planName} plan`
            : 'Subscription activation in progress'
      }
      shellClassName="checkout-shell"
      cardClassName="checkout-card"
      success={state === 'confirmed' ? `Subscription active. Remaining included credits: ${remainingCredits ?? 0}.` : undefined}
    >
      {state === 'polling' ? (
        <>
          <div className="loading-spinner" aria-hidden="true" />
          <p className="auth-copy">We are confirming your subscription and credits now.</p>
        </>
      ) : null}
      {state === 'pending' ? (
        <p className="auth-copy">
          Your subscription is activating - credits will be available shortly.
        </p>
      ) : null}
      <Link href="/" className="landing-secondary">
        Go to workspace
      </Link>
    </AuthLayout>
  );
}
