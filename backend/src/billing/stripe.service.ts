import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { AppError } from '../common/errors/app-error';
import { STRIPE_API_VERSION } from './billing.constants';
import { BillingConfigService } from './billing-config.service';

export type MontiStripeClient = InstanceType<typeof Stripe>;

@Injectable()
export class StripeService {
  private readonly client: MontiStripeClient | null;

  constructor(private readonly config: BillingConfigService) {
    const key = config.stripeSecretKey;
    this.client = key
      ? new Stripe(key, {
          apiVersion: STRIPE_API_VERSION,
          typescript: true,
        })
      : null;
  }

  getClient(): MontiStripeClient | null {
    return this.client;
  }

  requireStripe(): MontiStripeClient {
    if (!this.client) {
      throw new AppError(
        'INTERNAL_ERROR',
        'Stripe is not configured (set STRIPE_SECRET_KEY for this environment).',
        503,
      );
    }
    return this.client;
  }
}
