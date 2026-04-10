'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Provider } from '@supabase/supabase-js';
import {
  signInWithOAuthProvider,
  signUpWithEmailPassword,
} from '@/lib/auth/auth-flow';
import { resolveSafeNextPath } from '@/lib/auth/next-path';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { AuthLayout } from '@/app/components/auth-layout';
import { OAuthButtons } from '@/app/components/oauth-buttons';

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpFallback />}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpFallback() {
  return (
    <AuthLayout title="Create your account" subtitle="Preparing your sign-up options..." />
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const getSupabaseClient = useSupabaseClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const nextPath = resolveSafeNextPath(searchParams.get('next'));

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

    const { client: supabase, error: clientError } = getSupabaseClient();
    if (!supabase) {
      setErrorMessage(clientError ?? 'Sign-up is not configured in this environment.');
      setSubmitting(false);
      return;
    }

    const origin = window.location.origin;
    const { data, error } = await signUpWithEmailPassword(supabase.auth, {
      email,
      password,
      origin,
      nextPath,
    });

    if (error) {
      setSubmitting(false);
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      router.replace(nextPath);
      return;
    }

    setSubmitting(false);
    setSuccessMessage('Account created. Check your email for a confirmation link if required.');
  }

  async function handleOAuth(provider: Provider) {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { client: supabase, error: clientError } = getSupabaseClient();
    if (!supabase) {
      setErrorMessage(clientError ?? 'Sign-up is not configured in this environment.');
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
      title={<>Create your account</>}
      error={errorMessage}
      success={successMessage}
      links={<Link href="/sign-in">Already have an account? Sign in</Link>}
    >
      <OAuthButtons onOAuth={(p) => void handleOAuth(p)} disabled={submitting} />
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
          {submitting ? 'Creating your account...' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
