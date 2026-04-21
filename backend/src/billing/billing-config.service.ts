import { Injectable } from '@nestjs/common';
import { LAUNCH_PRICING_VERSION_KEY } from './billing.constants';

export interface LaunchPricingCatalog {
  readonly freeMonthlyCredits: number;
  readonly paidMonthlyCredits: number;
  readonly fastCredits: number;
  readonly qualityCredits: number;
  readonly topupCredits: number;
  readonly topupPriceUsd: number;
  readonly paidPlanPriceUsd: number;
}

function parseBool(raw: string | undefined): boolean {
  if (raw === undefined) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

@Injectable()
export class BillingConfigService {
  readonly billingEnabled: boolean;
  readonly creditEnforcementEnabled: boolean;
  readonly stripeWebhooksEnabled: boolean;
  readonly billingPortalEnabled: boolean;
  readonly freeCreditGrantsEnabled: boolean;
  readonly topupsEnabled: boolean;

  readonly stripeSecretKey: string | null;
  readonly stripeWebhookSecret: string | null;
  readonly stripePriceIdPaidMonthly: string | null;
  readonly stripePriceIdTopup50: string | null;
  readonly adminSecret: string | null;

  /** Public web origin for Checkout success/cancel redirects (e.g. https://app.example.com). */
  readonly billingPublicBaseUrl: string | null;
  /** Default return URL after Stripe Customer Portal (falls back to `billingPublicBaseUrl` when unset). */
  readonly billingPortalReturnUrl: string | null;

  readonly launchPricingVersionKey: string;
  readonly launchCatalog: LaunchPricingCatalog;

  constructor() {
    this.billingEnabled = parseBool(process.env.BILLING_ENABLED);
    this.creditEnforcementEnabled = parseBool(process.env.CREDIT_ENFORCEMENT_ENABLED);
    this.stripeWebhooksEnabled = parseBool(process.env.STRIPE_WEBHOOKS_ENABLED);
    this.billingPortalEnabled = parseBool(process.env.BILLING_PORTAL_ENABLED);
    this.freeCreditGrantsEnabled = parseBool(process.env.FREE_CREDIT_GRANTS_ENABLED);
    this.topupsEnabled = parseBool(process.env.TOPUPS_ENABLED);

    this.stripeSecretKey = optionalSecret(process.env.STRIPE_SECRET_KEY);
    this.stripeWebhookSecret = optionalSecret(process.env.STRIPE_WEBHOOK_SECRET);
    this.stripePriceIdPaidMonthly = optionalSecret(process.env.STRIPE_PRICE_ID_PAID_MONTHLY);
    this.stripePriceIdTopup50 = optionalSecret(process.env.STRIPE_PRICE_ID_TOPUP_50);
    this.adminSecret = optionalSecret(process.env.ADMIN_SECRET);

    this.billingPublicBaseUrl = optionalSecret(process.env.BILLING_PUBLIC_BASE_URL);
    this.billingPortalReturnUrl = optionalSecret(process.env.BILLING_PORTAL_RETURN_URL);

    this.launchPricingVersionKey = LAUNCH_PRICING_VERSION_KEY;
    this.launchCatalog = {
      freeMonthlyCredits: parsePositiveInt(process.env.BILLING_FREE_MONTHLY_CREDITS, 200),
      paidMonthlyCredits: parsePositiveInt(process.env.BILLING_PAID_MONTHLY_CREDITS, 1000),
      fastCredits: parsePositiveInt(process.env.BILLING_FAST_CREDITS, 1),
      qualityCredits: parsePositiveInt(process.env.BILLING_QUALITY_CREDITS, 5),
      topupCredits: parsePositiveInt(process.env.BILLING_TOPUP_CREDITS, 50),
      topupPriceUsd: parsePositiveInt(process.env.BILLING_TOPUP_PRICE_USD, 4),
      paidPlanPriceUsd: parsePositiveInt(process.env.BILLING_PAID_PLAN_PRICE_USD, 10),
    };
  }
}

function optionalSecret(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
