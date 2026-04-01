import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';

/** Append-only ledger orchestration; settlement wiring comes in a later change. */
@Injectable()
export class CreditLedgerService {
  private readonly logger = new Logger(CreditLedgerService.name);

  constructor(
    private readonly billingConfig: BillingConfigService,
    private readonly billingRepository: BillingRepository,
  ) {}

  async issueManualGrant(
    userId: string,
    credits: number,
    reason: string,
    operatorNote?: string,
  ): Promise<{ grantId: string; availableCredits: number }> {
    this.assertPositiveCredits(credits);
    const customer = await this.billingRepository.findBillingCustomerByUserId(userId);
    if (!customer) {
      throw new AppError('VALIDATION_ERROR', 'No billing customer record found for this user.', 404);
    }

    const snapshot = await this.billingRepository.findPricingRuleSnapshotByVersionKey(
      this.billingConfig.launchPricingVersionKey,
    );
    if (!snapshot) {
      throw new AppError('INTERNAL_ERROR', 'Missing pricing rule snapshot for manual grant.', 500);
    }

    const grantId = await this.billingRepository.insertManualGrantWithLedger({
      userId,
      pricingRuleSnapshotId: snapshot.id,
      credits,
      reason,
      operatorNote,
    });
    const availableCredits = await this.computeAvailableCredits(userId);

    this.logger.log(
      JSON.stringify({ event: 'billing.manual_grant', userId, credits, reason, operatorNote: operatorNote ?? null }),
    );

    return { grantId, availableCredits };
  }

  async issueManualReversal(
    userId: string,
    credits: number,
    reason: string,
    operatorNote?: string,
  ): Promise<{ availableCredits: number }> {
    this.assertPositiveCredits(credits);
    const customer = await this.billingRepository.findBillingCustomerByUserId(userId);
    if (!customer) {
      throw new AppError('VALIDATION_ERROR', 'No billing customer record found for this user.', 404);
    }

    const grant = await this.billingRepository.findMostSpendableGrantByUserId(userId);
    if (!grant || grant.remaining_credits < credits) {
      throw new AppError('VALIDATION_ERROR', 'Insufficient credits available for reversal.', 400);
    }

    await this.billingRepository.applyManualReversalToGrant({ grantId: grant.id, credits });
    await this.billingRepository.insertManualAdjustmentLedgerEntry({
      userId,
      grantId: grant.id,
      credits,
      reason,
      operatorNote,
    });
    const availableCredits = await this.computeAvailableCredits(userId);

    this.logger.log(
      JSON.stringify({
        event: 'billing.manual_reversal',
        userId,
        credits,
        reason,
        operatorNote: operatorNote ?? null,
      }),
    );

    return { availableCredits };
  }

  async listLedgerEntries(userId: string, limit = 50) {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 200)) : 50;
    return this.billingRepository.listLedgerEntriesByUserId(userId, safeLimit);
  }

  private async computeAvailableCredits(userId: string): Promise<number> {
    const grants = await this.billingRepository.listCreditGrantsByUserId(userId);
    return grants.reduce((sum, row) => sum + row.remaining_credits, 0);
  }

  private assertPositiveCredits(credits: number): void {
    if (!Number.isFinite(credits) || credits <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Credits must be greater than zero.', 400);
    }
  }
}
