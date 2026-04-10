'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { toErrorMessage } from '@/lib/errors';
import { AuthLayout } from '@/app/components/auth-layout';

type CheckoutResponse = {
  ok: true;
  data: {
    url?: string;
    checkoutUrl?: string;
  };
};

export default function CheckoutStartPage() {
  const router = useRouter();
  const startedRef = useRef(false);
  const getSupabaseClient = useSupabaseClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const { client: supabase } = getSupabaseClient();
    if (!supabase) {
      router.replace('/sign-in?next=/checkout/start');
      return;
    }
    const supabaseClient = supabase;

    async function startCheckout() {
      if (startedRef.current) {
        return;
      }
      startedRef.current = true;

      const { data, error } = await supabaseClient.auth.getSession();
      if (error || !data.session?.access_token) {
        router.replace('/sign-in?next=/checkout/start');
        return;
      }

      try {
        const response = await createAuthenticatedApiClient(data.session.access_token).postJson<CheckoutResponse>(
          '/api/billing/checkout/subscription',
          {},
        );
        const destination = response.data.checkoutUrl ?? response.data.url;
        if (!destination) {
          throw new Error('No checkout URL returned by the server.');
        }
        window.location.href = destination;
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      }
    }

    void startCheckout();
  }, [router]);

  return (
    <AuthLayout
      title="Starting secure checkout"
      shellClassName="checkout-shell"
      cardClassName="checkout-card"
      error={errorMessage}
    >
      {errorMessage ? (
        <Link href="/pricing" className="landing-secondary">
          Back to pricing
        </Link>
      ) : (
        <>
          <div className="loading-spinner" aria-hidden="true" />
          <p className="auth-copy">Creating your Stripe checkout session...</p>
        </>
      )}
    </AuthLayout>
  );
}
