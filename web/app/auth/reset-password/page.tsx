'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { AuthLayout } from '@/app/components/auth-layout';

export default function ResetPasswordPage() {
  const router = useRouter();
  const getSupabaseClient = useSupabaseClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleResetPassword(event: FormEvent) {
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

    const { client: supabase, error: clientError } = getSupabaseClient();
    if (!supabase) {
      setErrorMessage(clientError ?? 'Password reset is not configured in this environment.');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Password updated. Redirecting to sign in...');
    setTimeout(() => {
      router.replace('/sign-in');
    }, 800);
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Set a fresh password to continue."
      error={errorMessage}
      success={successMessage}
      links={<Link href="/sign-in">Back to sign in</Link>}
    >
      <form onSubmit={handleResetPassword} className="auth-form">
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={8}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving new password...' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  );
}
