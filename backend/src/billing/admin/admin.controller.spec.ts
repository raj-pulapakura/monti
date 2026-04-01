import { NotFoundException } from '@nestjs/common';
import { BillingRepository } from '../billing.repository';
import { CreditLedgerService } from '../credit-ledger.service';
import { StripeWebhookService } from '../stripe-webhook.service';
import { AdminController } from './admin.controller';

describe('AdminController', () => {
  it('replays failed webhook events', async () => {
    const repository = {
      findWebhookEventById: jest.fn().mockResolvedValue({
        id: 'event-row-1',
        stripe_event_id: 'evt_1',
        event_type: 'invoice.paid',
        payload: { id: 'in_1' },
      }),
      resetWebhookEventStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as BillingRepository;
    const creditLedger = {} as CreditLedgerService;
    const webhook = {
      processVerifiedEvent: jest.fn().mockResolvedValue('processed'),
    } as unknown as StripeWebhookService;

    const controller = new AdminController(creditLedger, repository, webhook);
    await expect(controller.postWebhookReplay({ eventId: 'event-row-1' })).resolves.toEqual({
      ok: true,
      data: { outcome: 'processed' },
    });
    expect(webhook.processVerifiedEvent).toHaveBeenCalledWith({
      id: 'evt_1',
      type: 'invoice.paid',
      data: { object: { id: 'in_1' } },
    });
  });

  it('returns duplicate for processed replay and 404 for unknown id', async () => {
    const repository = {
      findWebhookEventById: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'event-row-2',
          stripe_event_id: 'evt_2',
          event_type: 'invoice.paid',
          payload: { id: 'in_2' },
        })
        .mockResolvedValueOnce(null),
      resetWebhookEventStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as BillingRepository;
    const controller = new AdminController(
      {} as CreditLedgerService,
      repository,
      { processVerifiedEvent: jest.fn().mockResolvedValue('duplicate') } as unknown as StripeWebhookService,
    );

    await expect(controller.postWebhookReplay({ eventId: 'event-row-2' })).resolves.toEqual({
      ok: true,
      data: { outcome: 'duplicate' },
    });
    await expect(controller.postWebhookReplay({ eventId: 'missing' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
