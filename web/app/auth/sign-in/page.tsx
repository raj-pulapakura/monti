'use client';

import { FormEvent, Suspense, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Provider } from '@supabase/supabase-js';
import {
  signInWithEmailPassword,
  signInWithOAuthProvider,
} from '@/lib/auth/auth-flow';
import { resolveSafeNextPath } from '@/lib/auth/next-path';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInFallback() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Welcome back</h1>
        <p className="auth-copy">Preparing your sign-in options...</p>
      </section>
    </main>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextPath = resolveSafeNextPath(searchParams.get('next'));
  const incomingError = searchParams.get('error');
  const displayedError = errorMessage ?? incomingError;

  function getSupabaseClient() {
    if (supabaseRef.current) {
      return supabaseRef.current;
    }

    try {
      supabaseRef.current = createSupabaseBrowserClient();
      return supabaseRef.current;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Sign-in is not configured in this environment.',
      );
      return null;
    }
  }

  async function handlePasswordSignIn(event: FormEvent) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
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

    const supabase = getSupabaseClient();
    if (!supabase) {
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
    <main className="auth-shell">
      <section className="auth-card">
        <h1>
          Welcome back, <span className="display-script">creator</span>
        </h1>
        <p className="auth-copy">Sign in to continue your studio.</p>

        <div className="auth-oauth-list">
          <button type="button" onClick={() => void handleOAuth('google')} disabled={submitting}>
            Continue with Google
          </button>
          <button type="button" onClick={() => void handleOAuth('azure')} disabled={submitting}>
            Continue with Microsoft
          </button>
          <button type="button" onClick={() => void handleOAuth('apple')} disabled={submitting}>
            Continue with Apple
          </button>
        </div>

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

        {displayedError ? <p className="auth-error">{displayedError}</p> : null}

        <div className="auth-links">
          <Link href="/auth/sign-up">Create account</Link>
          <Link href="/auth/forgot-password">Forgot password?</Link>
        </div>
      </section>
    </main>
  );
}
