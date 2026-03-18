'use client';

import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Provider } from '@supabase/supabase-js';
import {
  signInWithOAuthProvider,
  signUpWithEmailPassword,
} from '@/lib/auth/auth-flow';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(
    null,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
          : 'Supabase authentication is not configured.',
      );
      return null;
    }
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setSubmitting(false);
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitting(false);
      setErrorMessage('Passwords do not match.');
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setSubmitting(false);
      return;
    }

    const origin = window.location.origin;
    const { data, error } = await signUpWithEmailPassword(supabase.auth, {
      email,
      password,
      origin,
    });

    if (error) {
      setSubmitting(false);
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      router.replace('/app');
      return;
    }

    setSubmitting(false);
    setSuccessMessage('Account created. Check your email if confirmation is enabled.');
  }

  async function handleOAuth(provider: Provider) {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setSubmitting(false);
      return;
    }

    const origin = window.location.origin;
    const { error } = await signInWithOAuthProvider(supabase.auth, {
      provider,
      origin,
      nextPath: '/app',
    });

    if (error) {
      setSubmitting(false);
      setErrorMessage(error.message);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Create your account</h1>
        <p className="auth-copy">
          Start building and refining experiences in your protected workspace.
        </p>

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

        <form onSubmit={handleSignUp} className="auth-form">
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
              minLength={8}
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create account'}
          </button>
        </form>

        {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}
        {successMessage ? <p className="auth-success">{successMessage}</p> : null}

        <div className="auth-links">
          <Link href="/auth/sign-in">Already have an account? Sign in</Link>
        </div>
      </section>
    </main>
  );
}
