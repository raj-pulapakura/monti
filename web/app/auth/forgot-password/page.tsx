'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { sendPasswordRecoveryEmail } from '@/lib/auth/auth-flow';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { AuthLayout } from '@/app/components/auth-layout';

export default function ForgotPasswordPage() {
  const getSupabaseClient = useSupabaseClient();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleForgotPassword(event: FormEvent) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { client: supabase, error: clientError } = getSupabaseClient();
    if (!supabase) {
      setErrorMessage(clientError ?? 'Password recovery is not configured in this environment.');
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
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we will send a reset link."
      error={errorMessage}
      success={successMessage}
      links={<Link href="/auth/sign-in">Back to sign in</Link>}
    >
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
    </AuthLayout>
  );
}
