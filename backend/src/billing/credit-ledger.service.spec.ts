import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';
import { CreditLedgerService } from './credit-ledger.service';

describe('CreditLedgerService', () => {
  function makeService(repo: Partial<BillingRepository>) {
    const config = { launchPricingVersionKey: 'launch-v1' } as BillingConfigService;
    return new CreditLedgerService(config, repo as BillingRepository);
  }

  it('issueManualGrant succeeds for known user', async () => {
    const repo: Partial<BillingRepository> = {
      findBillingCustomerByUserId: jest.fn().mockResolvedValue({ id: 'cust-1' }),
      findPricingRuleSnapshotByVersionKey: jest.fn().mockResolvedValue({ id: 'snap-1' }),
      insertManualGrantWithLedger: jest.fn().mockResolvedValue('grant-1'),
      listCreditGrantsByUserId: jest.fn().mockResolvedValue([{ remaining_credits: 17 }]),
    };
    const service = makeService(repo);

    await expect(service.issueManualGrant('user-1', 7, 'goodwill', 'note')).resolves.toEqual({
      grantId: 'grant-1',
      availableCredits: 17,
    });
  });

  it('issueManualGrant rejects unknown user and non-positive credits', async () => {
    const service = makeService({
      findBillingCustomerByUserId: jest.fn().mockResolvedValue(null),
    });

    await expect(service.issueManualGrant('user-1', 2, 'goodwill')).rejects.toThrow(
      'No billing customer record found',
    );
    await expect(service.issueManualGrant('user-1', 0, 'goodwill')).rejects.toThrow(
      'Credits must be greater than zero',
    );
  });

  it('issueManualReversal succeeds and enforces zero-floor', async () => {
    const repo: Partial<BillingRepository> = {
      findBillingCustomerByUserId: jest.fn().mockResolvedValue({ id: 'cust-1' }),
      findMostSpendableGrantByUserId: jest
        .fn()
        .mockResolvedValueOnce({ id: 'grant-1', remaining_credits: 20 })
        .mockResolvedValueOnce({ id: 'grant-1', remaining_credits: 3 }),
      applyManualReversalToGrant: jest.fn().mockResolvedValue(undefined),
      insertManualAdjustmentLedgerEntry: jest.fn().mockResolvedValue(undefined),
      listCreditGrantsByUserId: jest.fn().mockResolvedValue([{ remaining_credits: 13 }]),
    };
    const service = makeService(repo);

    await expect(service.issueManualReversal('user-1', 7, 'correction')).resolves.toEqual({
      availableCredits: 13,
    });
    await expect(service.issueManualReversal('user-1', 5, 'correction')).rejects.toThrow(
      'Insufficient credits available for reversal',
    );
  });
});
