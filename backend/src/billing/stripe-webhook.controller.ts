import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Post,
  RawBody,
} from '@nestjs/common';
import Stripe from 'stripe';
import { BillingConfigService } from './billing-config.service';
import type { StripeWebhookEventPayload } from './stripe-webhook.types';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('api/billing')
export class StripeWebhookController {
  constructor(
    private readonly config: BillingConfigService,
    private readonly webhookService: StripeWebhookService,
  ) {}

  /**
   * Stripe webhooks must not use JWT auth; verification is via `Stripe-Signature`.
   *
   * When `STRIPE_WEBHOOKS_ENABLED` is false: returns 200 without signature verification or DB writes
   * so Stripe does not retry indefinitely (see change design).
   */
  @Post('webhooks/stripe')
  @HttpCode(200)
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string | undefined,
    @RawBody() rawBody: Buffer | undefined,
  ): Promise<{ ok: true; ignored?: true; received?: true; duplicate?: boolean }> {
    if (!this.config.stripeWebhooksEnabled) {
      return { ok: true, ignored: true };
    }

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException('Missing raw request body for webhook verification');
    }
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    const secret = this.config.stripeWebhookSecret;
    if (!secret) {
      throw new HttpException('STRIPE_WEBHOOK_SECRET is not configured', 500);
    }

    let event: StripeWebhookEventPayload;
    try {
      event = Stripe.webhooks.constructEvent(rawBody, signature, secret) as StripeWebhookEventPayload;
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    const outcome = await this.webhookService.processVerifiedEvent(event);
    return { ok: true, received: true, duplicate: outcome === 'duplicate' };
  }
}
