'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Provider } from '@supabase/supabase-js';
import {
  signInWithEmailPassword,
  signInWithOAuthProvider,
} from '@/lib/auth/auth-flow';
import { resolveSafeNextPath } from '@/lib/auth/next-path';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { AuthLayout } from '@/app/components/auth-layout';
import { OAuthButtons } from '@/app/components/oauth-buttons';

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInFallback() {
  return (
    <AuthLayout title="Welcome back" subtitle="Preparing your sign-in options..." />
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const getSupabaseClient = useSupabaseClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextPath = resolveSafeNextPath(searchParams.get('next'));
  const incomingError = searchParams.get('error');
  const displayedError = errorMessage ?? incomingError;

  async function handlePasswordSignIn(event: FormEvent) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const { client: supabase, error: clientError } = getSupabaseClient();
    if (!supabase) {
      setErrorMessage(clientError ?? 'Sign-in is not configured in this environment.');
      setSubmitting(false);
      return;
    }

    const { error } = await signInWithEmailPassword(supabase.auth, {
      email,
      password,
    });

    if (error) {
      setSubmitting(false);
      setErrorMessage(error.message);
      return;
    }

    router.replace(nextPath);
  }

  async function handleOAuth(provider: Provider) {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const { client: supabase, error: clientError } = getSupabaseClient();
    if (!supabase) {
      setErrorMessage(clientError ?? 'Sign-in is not configured in this environment.');
      setSubmitting(false);
      return;
    }

    const origin = window.location.origin;
    const { error } = await signInWithOAuthProvider(supabase.auth, {
      provider,
      origin,
      nextPath,
    });

    if (error) {
      setSubmitting(false);
      setErrorMessage(error.message);
    }
  }

  return (
    <AuthLayout
      title={<>Sign in</>}
      error={displayedError}
      links={
        <>
          <Link href="/sign-up">Create account</Link>
          <Link href="/auth/forgot-password">Forgot password?</Link>
        </>
      }
    >
      <OAuthButtons onOAuth={(p) => void handleOAuth(p)} disabled={submitting} />
      <form onSubmit={handlePasswordSignIn} className="auth-form">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing you in...' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
