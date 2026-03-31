import { AppError } from '../common/errors/app-error';
import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';
import { EntitlementService } from './entitlement.service';

describe('EntitlementService', () => {
  const catalog = {
    freeMonthlyCredits: 15,
    paidMonthlyCredits: 150,
    fastCredits: 1,
    qualityCredits: 5,
    topupCredits: 50,
    topupPriceUsd: 4,
    paidPlanPriceUsd: 10,
  };

  function makeService(deps: {
    billingConfig: Partial<BillingConfigService>;
    repository: Partial<InstanceType<typeof BillingRepository>>;
  }) {
    return new EntitlementService(deps.billingConfig as BillingConfigService, deps.repository as BillingRepository);
  }

  it('returns disabled payload when billing is off', async () => {
    const svc = makeService({
      billingConfig: { billingEnabled: false },
      repository: {},
    });
    await expect(svc.getBillingMe('user-1')).resolves.toMatchObject({
      billingEnabled: false,
      plan: 'free',
      buckets: [],
    });
  });

  it('calls ensureFreeMonthlyGrantWithLedger once for free plan when free grants enabled', async () => {
    const ensureFreeMonthlyGrantWithLedger = jest.fn().mockResolvedValue('grant-uuid');
    const listCreditGrantsByUserId = jest.fn().mockResolvedValue([]);
    const findPricingRuleSnapshotByVersionKey = jest.fn().mockResolvedValue({
      id: 'snap-1',
      version_key: 'launch-v1',
      rules_json: { freeMonthlyCredits: 20 },
    });
    const listBillingSubscriptionsByUserId = jest.fn().mockResolvedValue([]);

    const svc = makeService({
      billingConfig: {
        billingEnabled: true,
        freeCreditGrantsEnabled: true,
        launchPricingVersionKey: 'launch-v1',
        launchCatalog: catalog,
      } as BillingConfigService,
      repository: {
        findPricingRuleSnapshotByVersionKey,
        listBillingSubscriptionsByUserId,
        ensureFreeMonthlyGrantWithLedger,
        listCreditGrantsByUserId,
      },
    });

    await svc.getBillingMe('user-1');

    expect(ensureFreeMonthlyGrantWithLedger).toHaveBeenCalledTimes(1);
    expect(ensureFreeMonthlyGrantWithLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        pricingRuleSnapshotId: 'snap-1',
        amount: 20,
      }),
    );
  });

  it('does not ensure free grant when user is paid-active', async () => {
    const ensureFreeMonthlyGrantWithLedger = jest.fn();
    const future = new Date(Date.now() + 86_400_000).toISOString();

    const svc = makeService({
      billingConfig: {
        billingEnabled: true,
        freeCreditGrantsEnabled: true,
        launchPricingVersionKey: 'launch-v1',
        launchCatalog: catalog,
      } as BillingConfigService,
      repository: {
        findPricingRuleSnapshotByVersionKey: jest.fn().mockResolvedValue({
          id: 'snap-1',
          version_key: 'launch-v1',
          rules_json: {},
        }),
        listBillingSubscriptionsByUserId: jest.fn().mockResolvedValue([
          { current_period_end: future },
        ]),
        ensureFreeMonthlyGrantWithLedger,
        listCreditGrantsByUserId: jest.fn().mockResolvedValue([]),
      },
    });

    const data = await svc.getBillingMe('user-1');
    expect(data.plan).toBe('paid');
    expect(ensureFreeMonthlyGrantWithLedger).not.toHaveBeenCalled();
  });

  it('throws when free grants are enabled but pricing snapshot is missing', async () => {
    const svc = makeService({
      billingConfig: {
        billingEnabled: true,
        freeCreditGrantsEnabled: true,
        launchPricingVersionKey: 'launch-v1',
        launchCatalog: catalog,
      } as BillingConfigService,
      repository: {
        findPricingRuleSnapshotByVersionKey: jest.fn().mockResolvedValue(null),
        listBillingSubscriptionsByUserId: jest.fn().mockResolvedValue([]),
        ensureFreeMonthlyGrantWithLedger: jest.fn(),
        listCreditGrantsByUserId: jest.fn().mockResolvedValue([]),
      },
    });

    await expect(svc.getBillingMe('user-1')).rejects.toBeInstanceOf(AppError);
  });
});
