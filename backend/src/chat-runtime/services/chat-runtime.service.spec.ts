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

  it('includes experience preview content in thread list responses', async () => {
    const repository = {
      listThreads: jest.fn(async () => [
        {
          id: 'thread-1',
          user_id: 'client-1',
          title: 'Fractions game',
          archived_at: null,
          created_at: '2026-04-04T00:00:00.000Z',
          updated_at: '2026-04-04T00:05:00.000Z',
          sandbox_status: 'ready' as const,
          sandbox_updated_at: '2026-04-04T00:05:00.000Z',
          experience_html: '<main>Hello</main>',
          experience_css: 'body { color: red; }',
          experience_js: 'console.log("preview");',
          experience_title: 'Hello world',
          experience_is_favourite: true,
        },
      ]),
    };
    const events = {
      latestEventId: jest.fn(() => null),
    };
    const conversationLoop = {
      executeTurn: jest.fn(),
    };
    const service = new ChatRuntimeService(
      repository as never,
      events as never,
      conversationLoop as never,
    );

    const result = await service.listThreads({
      userId: 'client-1',
      request: {
        limit: 25,
      },
    });

    expect(repository.listThreads).toHaveBeenCalledWith({
      userId: 'client-1',
      limit: 25,
    });
    expect(result).toEqual({
      threads: [
        {
          id: 'thread-1',
          userId: 'client-1',
          title: 'Fractions game',
          archivedAt: null,
          createdAt: '2026-04-04T00:00:00.000Z',
          updatedAt: '2026-04-04T00:05:00.000Z',
          sandboxStatus: 'ready',
          sandboxUpdatedAt: '2026-04-04T00:05:00.000Z',
          experienceHtml: '<main>Hello</main>',
          experienceCss: 'body { color: red; }',
          experienceJs: 'console.log("preview");',
          experienceTitle: 'Hello world',
          isFavourite: true,
        },
      ],
    });
  });

  it('returns the accepted queued run while delegating execution to the conversation loop', async () => {
    const repository = {
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
      userId: 'client-1',
      request: {
        content: 'Build a quiz',
      },
    });

    expect(conversationLoop.executeTurn).toHaveBeenCalledTimes(1);
    expect(result.run?.status).toBe('queued');
  });

  it('does not block the submit response on later conversation loop failure', async () => {
    const repository = {
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
      userId: 'client-1',
      request: {
        content: 'Build a quiz',
      },
    });

    expect(conversationLoop.executeTurn).toHaveBeenCalledTimes(1);
    expect(result.run?.status).toBe('queued');
    expect(result.run?.error.code).toBeNull();
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
      updateMessageContentJson: jest.fn(async (input: { messageId: string; contentJson: Record<string, unknown> | null }) =>
        createMessageRow({
          id: input.messageId,
          content_json: input.contentJson,
        }),
      ),
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
      userId: 'client-1',
      request: {
        content: 'Build a quiz',
      },
    });

    expect(result.deduplicated).toBe(true);
    expect(conversationLoop.executeTurn).not.toHaveBeenCalled();
  });

  it('persists explicit generation mode and passes it into the queued conversation turn', async () => {
    const repository = {
      submitUserMessage: jest.fn(async () => ({
        message: createMessageRow({ id: 'message-fast' }),
        run: createRunRow({ id: 'run-fast' }),
        deduplicated: false,
      })),
      updateMessageContentJson: jest.fn(
        async (input: { messageId: string; contentJson: Record<string, unknown> | null }) =>
          createMessageRow({
            id: input.messageId,
            content_json: input.contentJson,
          }),
      ),
      recordRunProviderTrace: jest.fn(async () => undefined),
    };
    const events = {
      latestEventId: jest.fn(() => null),
    };
    const conversationLoop = {
      executeTurn: jest.fn(async () => createRunRow({ status: 'succeeded' })),
    };

    const service = new ChatRuntimeService(
      repository as never,
      events as never,
      conversationLoop as never,
    );

    const result = await service.submitMessage({
      threadId: 'thread-1',
      userId: 'client-1',
      request: {
        content: 'Build a quiz',
        generationMode: 'fast',
      },
    });

    expect(repository.updateMessageContentJson).toHaveBeenCalledWith({
      messageId: 'message-fast',
      contentJson: {
        generationMode: 'fast',
      },
    });
    expect(conversationLoop.executeTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: expect.objectContaining({
          id: 'message-fast',
          content_json: {
            generationMode: 'fast',
          },
        }),
      }),
    );
    expect(result.message.contentJson).toEqual({
      generationMode: 'fast',
    });
  });
});
