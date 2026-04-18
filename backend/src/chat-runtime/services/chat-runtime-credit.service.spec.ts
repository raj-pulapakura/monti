import { InsufficientCreditsError } from '../../common/errors/app-error';
import { ChatRuntimeService } from './chat-runtime.service';

function createRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    thread_id: 'thread-1',
    user_message_id: 'message-1',
    assistant_message_id: null,
    status: 'queued' as const,
    confirmation_tool_call_id: null,
    confirmation_metadata: null,
    router_tier: null,
    router_provider_hint: null,
    router_confidence: null,
    router_reason: null,
    router_fallback_reason: null,
    conversation_provider: null,
    conversation_model: null,
    provider: null,
    model: null,
    provider_request_raw: null,
    provider_response_raw: null,
    error_code: null,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMessageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'message-1',
    thread_id: 'thread-1',
    user_id: 'client-1',
    role: 'user' as const,
    content: 'Build a quiz',
    content_json: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function createRepositoryMock() {
  return {
    findUserMessageByIdempotencyKey: jest.fn(async () => null),
    findLatestRunForUserMessage: jest.fn(),
    seedThreadTitleIfEmpty: jest.fn(async () => undefined),
    submitUserMessage: jest.fn(async () => ({
      message: createMessageRow(),
      run: createRunRow(),
      deduplicated: false,
    })),
    updateMessageContentJson: jest.fn(async (input: { messageId: string; contentJson: Record<string, unknown> | null }) =>
      createMessageRow({
        id: input.messageId,
        content_json: input.contentJson,
      }),
    ),
    recordRunProviderTrace: jest.fn(async () => undefined),
  };
}

describe('ChatRuntimeService credit pre-check', () => {
  beforeEach(() => {
    process.env.CHAT_RUNTIME_ENABLED = 'true';
    process.env.CONVERSATION_LOOP_ENABLED = 'false';
  });

  afterEach(() => {
    delete process.env.CHAT_RUNTIME_ENABLED;
    delete process.env.CONVERSATION_LOOP_ENABLED;
  });

  it('allows submission when balance is sufficient for fast mode', async () => {
    const repository = createRepositoryMock();
    const entitlements = {
      readSpendableBalance: jest.fn(async () => ({ fast: 10, quality: 10 })),
    };
    const billingConfig = {
      billingEnabled: true,
      creditEnforcementEnabled: true,
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: {
        freeMonthlyCredits: 15,
        paidMonthlyCredits: 150,
        fastCredits: 1,
        qualityCredits: 5,
        topupCredits: 50,
        topupPriceUsd: 4,
        paidPlanPriceUsd: 10,
      },
    };
    const billingRepository = {
      findPricingRuleSnapshotByVersionKey: jest.fn(async () => ({
        id: 'snap-1',
        rules_json: {},
        version_key: 'launch-v1',
      })),
    };

    const service = new ChatRuntimeService(
      repository as never,
      { latestEventId: jest.fn(() => null) } as never,
      { executeTurn: jest.fn() } as never,
      entitlements as never,
      billingConfig as never,
      billingRepository as never,
    );

    await service.submitMessage({
      threadId: 'thread-1',
      userId: 'client-1',
      request: { content: 'hi' },
    });

    expect(repository.submitUserMessage).toHaveBeenCalled();
  });

  it('throws InsufficientCreditsError when balance is below fast cost', async () => {
    const repository = createRepositoryMock();
    const entitlements = {
      readSpendableBalance: jest.fn(async () => ({ fast: 0, quality: 0 })),
    };
    const billingConfig = {
      billingEnabled: true,
      creditEnforcementEnabled: true,
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: {
        freeMonthlyCredits: 15,
        paidMonthlyCredits: 150,
        fastCredits: 1,
        qualityCredits: 5,
        topupCredits: 50,
        topupPriceUsd: 4,
        paidPlanPriceUsd: 10,
      },
    };
    const billingRepository = {
      findPricingRuleSnapshotByVersionKey: jest.fn(async () => ({
        id: 'snap-1',
        rules_json: {},
        version_key: 'launch-v1',
      })),
    };

    const service = new ChatRuntimeService(
      repository as never,
      { latestEventId: jest.fn(() => null) } as never,
      { executeTurn: jest.fn() } as never,
      entitlements as never,
      billingConfig as never,
      billingRepository as never,
    );

    await expect(
      service.submitMessage({
        threadId: 'thread-1',
        userId: 'client-1',
        request: { content: 'hi' },
      }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    expect(repository.submitUserMessage).not.toHaveBeenCalled();
  });

  it('skips credit check when enforcement is disabled', async () => {
    const repository = createRepositoryMock();
    const entitlements = {
      readSpendableBalance: jest.fn(async () => ({ fast: 0, quality: 0 })),
    };
    const billingConfig = {
      billingEnabled: true,
      creditEnforcementEnabled: false,
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: {
        freeMonthlyCredits: 15,
        paidMonthlyCredits: 150,
        fastCredits: 1,
        qualityCredits: 5,
        topupCredits: 50,
        topupPriceUsd: 4,
        paidPlanPriceUsd: 10,
      },
    };
    const billingRepository = {
      findPricingRuleSnapshotByVersionKey: jest.fn(),
    };

    const service = new ChatRuntimeService(
      repository as never,
      { latestEventId: jest.fn(() => null) } as never,
      { executeTurn: jest.fn() } as never,
      entitlements as never,
      billingConfig as never,
      billingRepository as never,
    );

    await service.submitMessage({
      threadId: 'thread-1',
      userId: 'client-1',
      request: { content: 'hi' },
    });

    expect(entitlements.readSpendableBalance).not.toHaveBeenCalled();
    expect(repository.submitUserMessage).toHaveBeenCalled();
  });

  it('fails open when readSpendableBalance returns null', async () => {
    const repository = createRepositoryMock();
    const entitlements = {
      readSpendableBalance: jest.fn(async () => null),
    };
    const billingConfig = {
      billingEnabled: true,
      creditEnforcementEnabled: true,
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: {
        freeMonthlyCredits: 15,
        paidMonthlyCredits: 150,
        fastCredits: 1,
        qualityCredits: 5,
        topupCredits: 50,
        topupPriceUsd: 4,
        paidPlanPriceUsd: 10,
      },
    };
    const billingRepository = {
      findPricingRuleSnapshotByVersionKey: jest.fn(async () => ({
        id: 'snap-1',
        rules_json: {},
        version_key: 'launch-v1',
      })),
    };

    const service = new ChatRuntimeService(
      repository as never,
      { latestEventId: jest.fn(() => null) } as never,
      { executeTurn: jest.fn() } as never,
      entitlements as never,
      billingConfig as never,
      billingRepository as never,
    );

    await service.submitMessage({
      threadId: 'thread-1',
      userId: 'client-1',
      request: { content: 'hi' },
    });

    expect(repository.submitUserMessage).toHaveBeenCalled();
  });

  it('allows submit when balance covers fast minimum without persisting generation mode', async () => {
    const repository = createRepositoryMock();
    const entitlements = {
      readSpendableBalance: jest.fn(async () => ({ fast: 3, quality: 3 })),
    };
    const billingConfig = {
      billingEnabled: true,
      creditEnforcementEnabled: true,
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: {
        freeMonthlyCredits: 15,
        paidMonthlyCredits: 150,
        fastCredits: 1,
        qualityCredits: 5,
        topupCredits: 50,
        topupPriceUsd: 4,
        paidPlanPriceUsd: 10,
      },
    };
    const billingRepository = {
      findPricingRuleSnapshotByVersionKey: jest.fn(async () => ({
        id: 'snap-1',
        rules_json: {},
        version_key: 'launch-v1',
      })),
    };

    const service = new ChatRuntimeService(
      repository as never,
      { latestEventId: jest.fn(() => null) } as never,
      { executeTurn: jest.fn() } as never,
      entitlements as never,
      billingConfig as never,
      billingRepository as never,
    );

    await service.submitMessage({
      threadId: 'thread-1',
      userId: 'client-1',
      request: { content: 'hi' },
    });

    expect(repository.submitUserMessage).toHaveBeenCalled();
    expect(repository.updateMessageContentJson).not.toHaveBeenCalled();
  });

  it('insufficient fast balance throws InsufficientCreditsError', async () => {
    const repository = createRepositoryMock();
    const entitlements = {
      readSpendableBalance: jest.fn(async () => ({ fast: 0, quality: 0 })),
    };
    const billingConfig = {
      billingEnabled: true,
      creditEnforcementEnabled: true,
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: {
        freeMonthlyCredits: 15,
        paidMonthlyCredits: 150,
        fastCredits: 1,
        qualityCredits: 5,
        topupCredits: 50,
        topupPriceUsd: 4,
        paidPlanPriceUsd: 10,
      },
    };
    const billingRepository = {
      findPricingRuleSnapshotByVersionKey: jest.fn(async () => ({
        id: 'snap-1',
        rules_json: {},
        version_key: 'launch-v1',
      })),
    };

    const service = new ChatRuntimeService(
      repository as never,
      { latestEventId: jest.fn(() => null) } as never,
      { executeTurn: jest.fn() } as never,
      entitlements as never,
      billingConfig as never,
      billingRepository as never,
    );

    await expect(
      service.submitMessage({
        threadId: 'thread-1',
        userId: 'client-1',
        request: { content: 'hi' },
      }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    expect(repository.submitUserMessage).not.toHaveBeenCalled();
  });

  it('sufficient balance does not persist generation mode on submit', async () => {
    const repository = createRepositoryMock();
    const entitlements = {
      readSpendableBalance: jest.fn(async () => ({ fast: 10, quality: 10 })),
    };
    const billingConfig = {
      billingEnabled: true,
      creditEnforcementEnabled: true,
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: {
        freeMonthlyCredits: 15,
        paidMonthlyCredits: 150,
        fastCredits: 1,
        qualityCredits: 5,
        topupCredits: 50,
        topupPriceUsd: 4,
        paidPlanPriceUsd: 10,
      },
    };
    const billingRepository = {
      findPricingRuleSnapshotByVersionKey: jest.fn(async () => ({
        id: 'snap-1',
        rules_json: {},
        version_key: 'launch-v1',
      })),
    };

    const service = new ChatRuntimeService(
      repository as never,
      { latestEventId: jest.fn(() => null) } as never,
      { executeTurn: jest.fn() } as never,
      entitlements as never,
      billingConfig as never,
      billingRepository as never,
    );

    await service.submitMessage({
      threadId: 'thread-1',
      userId: 'client-1',
      request: { content: 'hi' },
    });

    expect(repository.updateMessageContentJson).not.toHaveBeenCalled();
  });
});
