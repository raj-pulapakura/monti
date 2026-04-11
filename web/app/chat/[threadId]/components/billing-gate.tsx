'use client';

export function BillingGate(input: {
  plan: 'free' | 'paid';
  billingActionPending: boolean;
  onBuyTopup: () => void;
}) {
  return (
    <p className="stream-notice" role="status" aria-live="polite">
      {input.plan === 'paid' ? (
        <>
          You do not have enough credits for this mode.
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
          <a href="/billing">Upgrade</a>.
        </>
      )}
    </p>
  );
}
