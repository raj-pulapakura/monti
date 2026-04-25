import { BillingConfigService } from './billing-config.service';
import { LAUNCH_PRICING_VERSION_KEY } from './billing.constants';

describe('BillingConfigService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults feature flags off when unset', () => {
    delete process.env.BILLING_ENABLED;
    delete process.env.CREDIT_ENFORCEMENT_ENABLED;
    const config = new BillingConfigService();
    expect(config.billingEnabled).toBe(false);
    expect(config.creditEnforcementEnabled).toBe(false);
    expect(config.stripeWebhooksEnabled).toBe(false);
    expect(config.billingPortalEnabled).toBe(false);
    expect(config.freeCreditGrantsEnabled).toBe(false);
    expect(config.topupsEnabled).toBe(false);
  });

  it.each([
    ['true', true],
    ['1', true],
    ['yes', true],
    ['on', true],
    ['TRUE', true],
    ['false', false],
    ['0', false],
    ['', false],
  ])('parses BILLING_ENABLED=%p as %p', (raw, expected) => {
    process.env.BILLING_ENABLED = raw;
    expect(new BillingConfigService().billingEnabled).toBe(expected);
  });

  it('treats unset Stripe secrets as null', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(new BillingConfigService().stripeSecretKey).toBeNull();
  });

  it('trims Stripe secret values', () => {
    process.env.STRIPE_SECRET_KEY = '  sk_test  ';
    expect(new BillingConfigService().stripeSecretKey).toBe('sk_test');
  });

  it('exposes launch catalog defaults aligned with launch-v2 seed', () => {
    delete process.env.BILLING_FREE_MONTHLY_CREDITS;
    const config = new BillingConfigService();
    expect(config.launchPricingVersionKey).toBe(LAUNCH_PRICING_VERSION_KEY);
    expect(config.launchCatalog.freeMonthlyCredits).toBe(200);
    expect(config.launchCatalog.paidMonthlyCredits).toBe(1000);
    expect(config.launchCatalog.fastCredits).toBe(1);
    expect(config.launchCatalog.qualityCredits).toBe(5);
    expect(config.launchCatalog.topupCredits).toBe(300);
    expect(config.launchCatalog.topupPriceUsd).toBe(4);
    expect(config.launchCatalog.paidPlanPriceUsd).toBe(10);
  });

  it('allows overriding launch catalog via env', () => {
    process.env.BILLING_FREE_MONTHLY_CREDITS = '20';
    expect(new BillingConfigService().launchCatalog.freeMonthlyCredits).toBe(20);
  });
});
