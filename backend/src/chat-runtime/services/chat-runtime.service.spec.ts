import { ChatRuntimeService } from './chat-runtime.service';

function createRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    thread_id: 'thread-1',
    user_message_id: 'message-1',
    assistant_message_id: null,
    status: 'queued' as const,
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

describe('ChatRuntimeService', () => {
  beforeEach(() => {
    process.env.CHAT_RUNTIME_ENABLED = 'true';
    process.env.CONVERSATION_LOOP_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.CHAT_RUNTIME_ENABLED;
    delete process.env.CONVERSATION_LOOP_ENABLED;
  });

  it('delegates queued runs to the conversation loop', async () => {
    const repository = {
      submitUserMessage: jest.fn(async () => ({
        message: createMessageRow(),
        run: createRunRow(),
        deduplicated: false,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
    };

    const events = {
      latestEventId: jest.fn(() => null),
    };

    const conversationLoop = {
      executeTurn: jest.fn(async () =>
        createRunRow({
          status: 'succeeded',
          assistant_message_id: 'assistant-1',
        }),
      ),
    };

    const service = new ChatRuntimeService(
      repository as never,
      events as never,
      conversationLoop as never,
    );

    const result = await service.submitMessage({
      threadId: 'thread-1',
      request: {
        userId: 'client-1',
        content: 'Build a quiz',
      },
    });

    expect(conversationLoop.executeTurn).toHaveBeenCalledTimes(1);
    expect(result.run?.status).toBe('succeeded');
  });

  it('returns failed status when conversation loop fails the run', async () => {
    const repository = {
      submitUserMessage: jest.fn(async () => ({
        message: createMessageRow(),
        run: createRunRow(),
        deduplicated: false,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
    };

    const events = {
      latestEventId: jest.fn(() => null),
    };

    const conversationLoop = {
      executeTurn: jest.fn(async () =>
        createRunRow({
          status: 'failed',
          error_code: 'PROVIDER_TIMEOUT',
          error_message: 'Provider timed out',
        }),
      ),
    };

    const service = new ChatRuntimeService(
      repository as never,
      events as never,
      conversationLoop as never,
    );

    const result = await service.submitMessage({
      threadId: 'thread-1',
      request: {
        userId: 'client-1',
        content: 'Build a quiz',
      },
    });

    expect(result.run?.status).toBe('failed');
    expect(result.run?.error.code).toBe('PROVIDER_TIMEOUT');
  });

  it('skips conversation loop when run is already terminal', async () => {
    const repository = {
      submitUserMessage: jest.fn(async () => ({
        message: createMessageRow({ id: 'message-existing' }),
        run: createRunRow({
          id: 'run-existing',
          status: 'succeeded',
          router_tier: 'fast',
          provider: 'openai',
          model: 'gpt-5-mini',
        }),
        deduplicated: true,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
    };

    const events = {
      latestEventId: jest.fn(() => null),
    };

    const conversationLoop = {
      executeTurn: jest.fn(async () => createRunRow()),
    };

    const service = new ChatRuntimeService(
      repository as never,
      events as never,
      conversationLoop as never,
    );

    const result = await service.submitMessage({
      threadId: 'thread-1',
      request: {
        userId: 'client-1',
        content: 'Build a quiz',
      },
    });

    expect(result.deduplicated).toBe(true);
    expect(conversationLoop.executeTurn).not.toHaveBeenCalled();
  });
});
