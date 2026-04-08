import { ValidationError } from '../../common/errors/app-error';
import { ChatRuntimeRepository } from './chat-runtime.repository';

describe('ChatRuntimeRepository', () => {
  function createClientForTitleUpdate(options: {
    thread: Record<string, unknown> | null;
    sandboxState: Record<string, unknown> | null;
    updatedExperience: Record<string, unknown> | null;
  }) {
    const chatThreadsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => ({ data: options.thread, error: null })),
    };

    const sandboxQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => ({
        data: options.sandboxState,
        error: null,
      })),
    };

    const experiencesQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => ({
        data: options.updatedExperience,
        error: null,
      })),
    };

    const client = {
      from: jest.fn((table: string) => {
        if (table === 'chat_threads') return chatThreadsQuery;
        if (table === 'sandbox_states') return sandboxQuery;
        if (table === 'experiences') return experiencesQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    return { client, chatThreadsQuery, sandboxQuery, experiencesQuery };
  }

  function createClientForThreadLookup(options: {
    thread: Record<string, unknown> | null;
  }) {
    const eqCalls: Array<{ column: string; value: unknown }> = [];

    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn((column: string, value: unknown) => {
        eqCalls.push({ column, value });
        return query;
      }),
      maybeSingle: jest.fn(async () => ({
        data: options.thread,
        error: null,
      })),
    };

    const client = {
      from: jest.fn(() => query),
    };

    return {
      client,
      query,
      eqCalls,
    };
  }

  it('allows thread access for the owner user scope', async () => {
    const mock = createClientForThreadLookup({
      thread: {
        id: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95',
        user_id: 'd4197995-f1cf-4d06-8fdf-28d625087445',
      },
    });
    const repository = new ChatRuntimeRepository(mock.client as never);

    await expect(
      repository.assertThreadAccess({
        threadId: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95',
        userId: 'd4197995-f1cf-4d06-8fdf-28d625087445',
      }),
    ).resolves.toBeUndefined();

    expect(mock.query.select).toHaveBeenCalledWith('*');
    expect(mock.eqCalls).toEqual([
      { column: 'id', value: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95' },
      { column: 'user_id', value: 'd4197995-f1cf-4d06-8fdf-28d625087445' },
    ]);
  });

  it('rejects thread access when the thread is not owned by the caller', async () => {
    const mock = createClientForThreadLookup({
      thread: null,
    });
    const repository = new ChatRuntimeRepository(mock.client as never);

    await expect(
      repository.assertThreadAccess({
        threadId: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95',
        userId: '34fda4d9-6629-43ff-b92a-2550f0d39774',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('persists router telemetry on a tool invocation', async () => {
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn(async () => ({
      error: null,
    }));
    const query = {
      update,
      eq,
    };
    const client = {
      from: jest.fn(() => query),
    };
    const repository = new ChatRuntimeRepository(client as never);

    await repository.recordToolInvocationRouterTelemetry({
      invocationId: 'tool-1',
      routerProvider: 'openai',
      routerModel: 'gpt-5-mini',
      routerRequestRaw: { model: 'gpt-5-mini' },
      routerResponseRaw: { output_text: '{"tier":"fast"}' },
      routerTokensIn: 18,
      routerTokensOut: 6,
      routerTier: 'fast',
      routerConfidence: 0.81,
      routerReason: 'straightforward request',
      routerFallbackReason: null,
      selectedProvider: 'gemini',
      selectedModel: 'gemini-3.1-flash-lite-preview',
    });

    expect(client.from).toHaveBeenCalledWith('tool_invocations');
    expect(update).toHaveBeenCalledWith({
      router_provider: 'openai',
      router_model: 'gpt-5-mini',
      router_request_raw: { model: 'gpt-5-mini' },
      router_response_raw: { output_text: '{"tier":"fast"}' },
      router_tokens_in: 18,
      router_tokens_out: 6,
      router_tier: 'fast',
      router_confidence: 0.81,
      router_reason: 'straightforward request',
      router_fallback_reason: null,
      selected_provider: 'gemini',
      selected_model: 'gemini-3.1-flash-lite-preview',
    });
    expect(eq).toHaveBeenCalledWith('id', 'tool-1');
  });

  it('updates the experience title for the thread sandbox experience', async () => {
    const mock = createClientForTitleUpdate({
      thread: {
        id: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95',
        user_id: 'd4197995-f1cf-4d06-8fdf-28d625087445',
      },
      sandboxState: {
        experience_id: 'exp-1',
      },
      updatedExperience: {
        title: 'New title',
      },
    });
    const repository = new ChatRuntimeRepository(mock.client as never);

    await expect(
      repository.updateExperienceTitle({
        threadId: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95',
        userId: 'd4197995-f1cf-4d06-8fdf-28d625087445',
        title: ' New title ',
      }),
    ).resolves.toEqual({ title: 'New title' });

    expect(mock.client.from).toHaveBeenCalledWith('chat_threads');
    expect(mock.client.from).toHaveBeenCalledWith('sandbox_states');
    expect(mock.client.from).toHaveBeenCalledWith('experiences');

    expect(mock.experiencesQuery.update).toHaveBeenCalledWith({
      title: 'New title',
    });
  });

  it('rejects title updates when no active experience exists', async () => {
    const mock = createClientForTitleUpdate({
      thread: {
        id: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95',
        user_id: 'd4197995-f1cf-4d06-8fdf-28d625087445',
      },
      sandboxState: {
        experience_id: null,
      },
      updatedExperience: null,
    });
    const repository = new ChatRuntimeRepository(mock.client as never);

    await expect(
      repository.updateExperienceTitle({
        threadId: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95',
        userId: 'd4197995-f1cf-4d06-8fdf-28d625087445',
        title: 'New title',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('persists assistant-run conversation token totals on completion', async () => {
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn(async () => ({
      error: null,
    }));
    const query = {
      update,
      eq,
    };
    const client = {
      from: jest.fn(() => query),
    };
    const repository = new ChatRuntimeRepository(client as never);

    await repository.markRunSucceeded({
      runId: 'run-1',
      assistantMessageId: 'assistant-1',
      conversationTokensIn: 150,
      conversationTokensOut: 42,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        assistant_message_id: 'assistant-1',
        conversation_tokens_in: 150,
        conversation_tokens_out: 42,
      }),
    );
    expect(eq).toHaveBeenCalledWith('id', 'run-1');
  });
});
