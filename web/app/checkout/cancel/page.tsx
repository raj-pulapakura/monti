'use client';

import Link from 'next/link';
import { AuthLayout } from '@/app/components/auth-layout';

export default function CheckoutCancelPage() {
  return (
    <AuthLayout
      title="No worries - your plan stays the same."
      shellClassName="checkout-shell"
      cardClassName="checkout-card"
    >
      <p className="auth-copy">
        You can come back to pricing anytime when you're ready.
      </p>
      <Link href="/pricing" className="landing-secondary">
        Back to pricing
      </Link>
    </AuthLayout>
  );
}
