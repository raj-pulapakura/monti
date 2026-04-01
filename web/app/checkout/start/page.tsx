'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

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
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
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
    const supabase = getSupabaseClient();
    if (!supabase) {
      router.replace('/auth/sign-in?next=/checkout/start');
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
        router.replace('/auth/sign-in?next=/checkout/start');
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
    <main className="auth-shell checkout-shell">
      <section className="auth-card checkout-card">
        <h1>Starting secure checkout</h1>
        {errorMessage ? (
          <>
            <p className="auth-error">{errorMessage}</p>
            <Link href="/pricing" className="landing-secondary">
              Back to pricing
            </Link>
          </>
        ) : (
          <>
            <div className="loading-spinner" aria-hidden="true" />
            <p className="auth-copy">Creating your Stripe checkout session...</p>
          </>
        )}
      </section>
    </main>
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unable to start checkout right now.';
}
