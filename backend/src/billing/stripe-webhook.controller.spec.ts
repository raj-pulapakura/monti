import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BillingConfigService } from './billing-config.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

describe('StripeWebhookController', () => {
  it('returns ignored when STRIPE_WEBHOOKS_ENABLED is false without verifying signature', async () => {
    const config = {
      stripeWebhooksEnabled: false,
      stripeWebhookSecret: null,
    } as BillingConfigService;

    const webhookService = {
      processVerifiedEvent: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        { provide: BillingConfigService, useValue: config },
        { provide: StripeWebhookService, useValue: webhookService },
      ],
    }).compile();

    const controller = moduleRef.get(StripeWebhookController);
    await expect(
      controller.handleStripeWebhook('sig_header', Buffer.from('{}')),
    ).resolves.toEqual({ ok: true, ignored: true });
    expect(webhookService.processVerifiedEvent).not.toHaveBeenCalled();
  });

  it('rejects when raw body is missing', async () => {
    const config = {
      stripeWebhooksEnabled: true,
      stripeWebhookSecret: 'whsec_test',
    } as BillingConfigService;

    const moduleRef = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        { provide: BillingConfigService, useValue: config },
        { provide: StripeWebhookService, useValue: { processVerifiedEvent: jest.fn() } },
      ],
    }).compile();

    const controller = moduleRef.get(StripeWebhookController);
    await expect(controller.handleStripeWebhook('sig', undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
