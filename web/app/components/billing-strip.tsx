'use client';

import type { BillingMeResponse } from '@/lib/api/billing-me';

export function BillingStrip(input: {
  billingData: BillingMeResponse['data'];
}) {
  const { billingData } = input;

  return (
    <section className="home-billing-strip" aria-label="Credits and plan">
      <p className="home-billing-strip-text">
        <span className="home-billing-plan">
          {billingData.plan === 'paid' ? 'Paid' : 'Free'} plan
        </span>
        <span className="home-billing-sep" aria-hidden="true">·</span>
        <span>
          {billingData.includedCreditsAvailable ?? 0} included credits left
        </span>
        {typeof billingData.topupCreditsAvailable === 'number' &&
        billingData.topupCreditsAvailable > 0 ? (
          <>
            <span className="home-billing-sep" aria-hidden="true">·</span>
            <span>{billingData.topupCreditsAvailable} top-up credits available</span>
          </>
        ) : null}
        <span className="home-billing-sep" aria-hidden="true">·</span>
        <span>
          Fast {billingData.costs.fastCredits ?? '—'} · Quality{' '}
          {billingData.costs.qualityCredits ?? '—'} credits
        </span>
      </p>
    </section>
  );
}
