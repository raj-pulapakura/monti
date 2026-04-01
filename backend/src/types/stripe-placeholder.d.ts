/**
 * Minimal `stripe` module declaration so `nest build` works before/without `node_modules/stripe`.
 * After `npm install stripe`, you may delete this file if TypeScript reports duplicate declarations.
 */
declare module 'stripe' {
  class Stripe {
    constructor(apiKey: string, config?: { apiVersion?: string; typescript?: boolean });
    customers: { create(params: Record<string, unknown>): Promise<{ id: string }> };
    checkout: {
      sessions: {
        create(params: Record<string, unknown>): Promise<{ id: string; url: string | null }>;
      };
    };
    billingPortal: {
      sessions: {
        create(params: Record<string, unknown>): Promise<{ url: string | null }>;
      };
    };
    subscriptions: {
      retrieve(id: string): Promise<Record<string, unknown>>;
    };
    static webhooks: {
      constructEvent(
        payload: string | Buffer,
        header: string | Buffer | string[],
        secret: string,
      ): { id: string; type: string; data: { object: unknown } };
    };
  }
  export default Stripe;
}
