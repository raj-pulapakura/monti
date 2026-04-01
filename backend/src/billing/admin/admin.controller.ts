import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { BillingRepository } from '../billing.repository';
import { CreditLedgerService } from '../credit-ledger.service';
import { StripeWebhookService } from '../stripe-webhook.service';
import type {
  ManualCreditRequestDto,
  UserLedgerParamsDto,
  UserLedgerQueryDto,
  WebhookReplayParamsDto,
} from './admin.dto';
import { AdminGuard } from './admin.guard';

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly creditLedger: CreditLedgerService,
    private readonly billingRepository: BillingRepository,
    private readonly stripeWebhookService: StripeWebhookService,
  ) {}

  @Post('credits/grant')
  async postManualGrant(@Body() body: ManualCreditRequestDto) {
    const data = await this.creditLedger.issueManualGrant(
      body.userId,
      body.credits,
      body.reason,
      body.operatorNote,
    );
    return { ok: true, data };
  }

  @Post('credits/reverse')
  async postManualReversal(@Body() body: ManualCreditRequestDto) {
    const data = await this.creditLedger.issueManualReversal(
      body.userId,
      body.credits,
      body.reason,
      body.operatorNote,
    );
    return { ok: true, data };
  }

  @Get('users/:userId/ledger')
  async getUserLedger(@Param() params: UserLedgerParamsDto, @Query() query: UserLedgerQueryDto) {
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 50;
    const entries = await this.creditLedger.listLedgerEntries(params.userId, limit);
    return { ok: true, data: entries };
  }

  @Post('webhooks/:eventId/replay')
  async postWebhookReplay(@Param() params: WebhookReplayParamsDto) {
    const row = await this.billingRepository.findWebhookEventById(params.eventId);
    if (!row) {
      throw new NotFoundException('Webhook event not found.');
    }
    await this.billingRepository.resetWebhookEventStatus(row.id);
    const outcome = await this.stripeWebhookService.processVerifiedEvent({
      id: row.stripe_event_id,
      type: row.event_type,
      data: { object: row.payload ?? {} },
    });
    this.logger.log(
      JSON.stringify({
        event: 'billing.webhook_replayed',
        eventId: row.id,
        stripeEventId: row.stripe_event_id,
        outcome,
      }),
    );
    return { ok: true, data: { outcome } };
  }

  @Get('reconciliation/summary')
  async getReconciliationSummary() {
    const data = await this.billingRepository.listReconciliationSummary();
    return { ok: true, data };
  }
}
