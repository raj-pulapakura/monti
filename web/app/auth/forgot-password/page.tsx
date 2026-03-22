'use client';

import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { sendPasswordRecoveryEmail } from '@/lib/auth/auth-flow';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(
    null,
  );
  const [email, setEmail] = useState('');
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
          : 'Password recovery is not configured in this environment.',
      );
      return null;
    }
  }

  async function handleForgotPassword(event: FormEvent) {
    event.preventDefault();
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
    const { error } = await sendPasswordRecoveryEmail(supabase.auth, {
      email,
      origin,
    });

    setSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(
      'If this email exists, a reset link has been sent. Check your inbox.',
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Reset your password</h1>
        <p className="auth-copy">Enter your email and we will send a reset link.</p>

        <form onSubmit={handleForgotPassword} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Sending reset link...' : 'Send reset link'}
          </button>
        </form>

        {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}
        {successMessage ? <p className="auth-success">{successMessage}</p> : null}

        <div className="auth-links">
          <Link href="/auth/sign-in">Back to sign in</Link>
        </div>
      </section>
    </main>
  );
}
