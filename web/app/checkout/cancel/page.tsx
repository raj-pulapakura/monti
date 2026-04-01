'use client';

import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <main className="auth-shell checkout-shell">
      <section className="auth-card checkout-card">
        <h1>No worries - your plan stays the same.</h1>
        <p className="auth-copy">
          You can come back to pricing anytime when the timing is right for your classroom.
        </p>
        <Link href="/pricing" className="landing-secondary">
          Back to pricing
        </Link>
      </section>
    </main>
  );
}
