'use client';

import { CircleAlert } from 'lucide-react';

export function BillingGate(input: {
  plan: 'free' | 'paid';
  billingActionPending: boolean;
  onBuyTopup: () => void;
}) {
  return (
    <p className="stream-notice billing-gate-notice" role="status" aria-live="polite">
      <CircleAlert className="billing-gate-notice-icon" size={18} strokeWidth={2.2} aria-hidden />
      <span className="billing-gate-notice-text">
        {input.plan === 'paid' ? (
          <>
            You do not have enough credits for this mode.{' '}
            <button
              type="button"
              className="inline-link-button"
              onClick={input.onBuyTopup}
              disabled={input.billingActionPending}
            >
              {input.billingActionPending ? ' Opening checkout...' : ' Buy top-up'}
            </button>
            .
          </>
        ) : (
          <>
            You do not have enough credits for this mode.{' '}
            <a className="inline-link-button" href="/settings/billing">
              Upgrade
            </a>
            .
          </>
        )}
      </span>
    </p>
  );
}
