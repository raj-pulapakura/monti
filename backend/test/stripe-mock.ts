/**
 * Jest-only stand-in for the `stripe` package so tests run when `node_modules/stripe`
 * is not installed. Production builds use the real SDK from npm.
 */
export default class StripeMock {
  customers = {
    create: async () => ({ id: 'cus_mock' }),
  };

  checkout = {
    sessions: {
      create: async () => ({ id: 'cs_mock', url: 'https://checkout.stripe.test/mock' }),
    },
  };

  billingPortal = {
    sessions: {
      create: async () => ({ url: 'https://billing.stripe.test/mock' }),
    },
  };

  subscriptions = {
    retrieve: async () => ({
      id: 'sub_mock',
      customer: 'cus_mock',
      status: 'active',
      cancel_at_period_end: false,
      // current_period_start/end moved to items in API 2026-03-25.dahlia
      items: {
        data: [
          {
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 86_400,
          },
        ],
      },
    }),
  };

  constructor(_apiKey: string, _config?: Record<string, unknown>) {}

  static webhooks = {
    constructEvent(payload: Buffer | string, header: string | Buffer | string[], secret: string) {
      if (!header || !secret) {
        throw new Error('Missing stripe webhook header or secret');
      }
      if (header === 'bad_sig') {
        throw new Error('Invalid signature');
      }
      const raw = typeof payload === 'string' ? payload : payload.toString('utf8');
      return JSON.parse(raw) as { id: string; type: string; data: { object: Record<string, unknown> } };
    },
  };
}
