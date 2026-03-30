import { observedUsage, unavailableUsage } from '../../llm/llm-usage';
import { ConversationLoopService } from './conversation-loop.service';

function createRun(overrides: Record<string, unknown> = {}) {
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
    conversation_tokens_in: null,
    conversation_tokens_out: null,
    error_code: null,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function createAssistantMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'assistant-1',
    thread_id: 'thread-1',
    user_id: 'client-1',
    role: 'assistant' as const,
    content: 'Sure, I can help with that.',
    content_json: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('ConversationLoopService', () => {
  it('completes with a model-authored assistant message when no tools are configured', async () => {
    const repository = {
      markRunRunning: jest.fn(async () => undefined),
      hydrateThread: jest.fn(async () => ({
        thread: { id: 'thread-1' },
        messages: [
          {
            id: 'message-1',
            thread_id: 'thread-1',
            user_id: 'client-1',
            role: 'user',
            content: 'Teach me planets',
            content_json: null,
          },
        ],
        sandboxState: { thread_id: 'thread-1', status: 'empty' },
        activeRun: null,
        activeToolInvocation: null,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
      createAssistantMessage: jest.fn(async (input?: { content?: string; contentJson?: Record<string, unknown> | null }) =>
        createAssistantMessage({
          content: input?.content ?? 'Sure, I can help with that.',
          content_json: input?.contentJson ?? null,
        }),
      ),
      markRunSucceeded: jest.fn(async () => undefined),
      getRunById: jest.fn(async () =>
        createRun({
          status: 'succeeded',
          assistant_message_id: 'assistant-1',
        }),
      ),
      markRunFailed: jest.fn(async () => undefined),
    };

    const events = {
      publish: jest.fn(),
    };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => []),
      hasTool: jest.fn(() => false),
      executeToolCall: jest.fn(async () => {
        throw new Error('should not be called');
      }),
    };

    const toolLlmRouter = {
      runTurn: jest.fn(async (input: { onAssistantTextSnapshot?: (text: string) => void }) => {
        await input.onAssistantTextSnapshot?.('Sure');
        await input.onAssistantTextSnapshot?.('Sure, I can help with that.');

        return {
          provider: 'openai' as const,
          model: 'gpt-5.4',
          assistantText: 'Sure, I can help with that.',
          toolCalls: [],
          finishReason: 'stop' as const,
          usage: observedUsage({
            inputTokens: 120,
            outputTokens: 30,
          }),
          rawRequest: {},
          rawResponse: {},
        };
      }),
    };

    const llmConfig = {
      conversationProvider: 'openai' as const,
      conversationModel: 'gpt-5.4',
      conversationMaxTokens: 2048,
      conversationMaxToolRounds: 3,
      conversationSystemPrompt: 'You are Monti',
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
    );

    const result = await service.executeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      userMessage: {
        id: 'message-1',
        thread_id: 'thread-1',
        user_id: 'client-1',
        role: 'user',
        content: 'Teach me planets',
        content_json: null,
        idempotency_key: null,
        created_at: new Date().toISOString(),
      },
      run: createRun(),
    });

    expect(result.status).toBe('succeeded');
    expect(toolRegistry.executeToolCall).not.toHaveBeenCalled();
    expect(repository.markRunSucceeded).toHaveBeenCalledTimes(1);
    expect(repository.markRunSucceeded).toHaveBeenCalledWith({
      runId: 'run-1',
      assistantMessageId: 'assistant-1',
      conversationTokensIn: 120,
      conversationTokensOut: 30,
    });
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'assistant_message_started',
        payload: {
          draftId: 'run-1',
          content: 'Sure',
        },
      }),
    );
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'assistant_message_updated',
        payload: {
          draftId: 'run-1',
          content: 'Sure, I can help with that.',
        },
      }),
    );
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'assistant_message_created',
        payload: expect.objectContaining({
          message: expect.objectContaining({
            content: 'Sure, I can help with that.',
          }),
        }),
      }),
    );
  });

  it('supports multi-round tool calls before terminal assistant output', async () => {
    const repository = {
      markRunRunning: jest.fn(async () => undefined),
      hydrateThread: jest.fn(async () => ({
        thread: { id: 'thread-1' },
        messages: [
          {
            id: 'message-1',
            thread_id: 'thread-1',
            user_id: 'client-1',
            role: 'user',
            content: 'Build a quiz',
            content_json: null,
          },
        ],
        sandboxState: { thread_id: 'thread-1', status: 'empty' },
        activeRun: null,
        activeToolInvocation: null,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
      createToolInvocation: jest.fn(async () => ({
        id: 'tool-1',
        tool_name: 'generate_experience',
      })),
      markToolInvocationSucceeded: jest.fn(async () => undefined),
      markToolInvocationFailed: jest.fn(async () => undefined),
      findExperienceVersionByGenerationId: jest.fn(async () => ({
        experienceId: 'exp-1',
        versionId: 'ver-1',
      })),
      updateSandboxState: jest.fn(async () => undefined),
      createAssistantMessage: jest.fn(async (input?: { content?: string; contentJson?: Record<string, unknown> | null }) =>
        createAssistantMessage({
          content: input?.content ?? 'Building now.',
          content_json: input?.contentJson ?? null,
        }),
      ),
      markRunSucceeded: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      getRunById: jest.fn(async () =>
        createRun({
          status: 'succeeded',
          assistant_message_id: 'assistant-1',
        }),
      ),
    };

    const events = {
      publish: jest.fn(),
    };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => [
        {
          name: 'generate_experience',
          description: 'generate',
          inputSchema: { type: 'object' },
        },
      ]),
      hasTool: jest.fn((name: string) => name === 'generate_experience'),
      executeToolCall: jest.fn(async () => ({
        toolName: 'generate_experience',
        toolCallId: 'call-1',
        result: {
          status: 'succeeded' as const,
          generationId: 'gen-1',
          experienceId: null,
          experienceVersionId: null,
          errorCode: null,
          errorMessage: null,
          sandboxStatus: 'ready' as const,
          route: {
            tier: 'fast' as const,
            confidence: 0.8,
            reason: 'simple request',
            fallbackReason: null,
            selectedProvider: 'openai' as const,
            selectedModel: 'gpt-5-mini',
          },
        },
      })),
    };

    const toolLlmRouter = {
      runTurn: jest
        .fn()
        .mockResolvedValueOnce({
          provider: 'openai' as const,
          model: 'gpt-5.4',
          assistantText: 'Building now.',
          toolCalls: [
            {
              id: 'call-1',
              name: 'generate_experience',
              arguments: { operation: 'generate', prompt: 'Build a quiz' },
            },
          ],
          finishReason: 'tool_calls' as const,
          usage: observedUsage({
            inputTokens: 90,
            outputTokens: 25,
          }),
          providerContinuation: {
            openai: {
              previousResponseId: 'resp-1',
            },
          },
          rawRequest: {},
          rawResponse: {},
        })
        .mockResolvedValueOnce({
          provider: 'openai' as const,
          model: 'gpt-5.4',
          assistantText: 'Experience generated.',
          toolCalls: [],
          finishReason: 'stop' as const,
          usage: observedUsage({
            inputTokens: 60,
            outputTokens: 17,
          }),
          rawRequest: {},
          rawResponse: {},
        }),
    };

    const llmConfig = {
      conversationProvider: 'openai' as const,
      conversationModel: 'gpt-5.4',
      conversationMaxTokens: 2048,
      conversationMaxToolRounds: 3,
      conversationSystemPrompt: 'You are Monti',
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
    );

    const result = await service.executeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      userMessage: {
        id: 'message-1',
        thread_id: 'thread-1',
        user_id: 'client-1',
        role: 'user',
        content: 'Build a quiz',
        content_json: null,
        idempotency_key: null,
        created_at: new Date().toISOString(),
      },
      run: createRun(),
    });

    expect(result.status).toBe('succeeded');
    expect(toolRegistry.executeToolCall).toHaveBeenCalledTimes(1);
    expect(repository.markRunSucceeded).toHaveBeenCalledTimes(1);
    expect(toolRegistry.executeToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        invocationId: 'tool-1',
      }),
    );
    expect(repository.markRunSucceeded).toHaveBeenCalledWith({
      runId: 'run-1',
      assistantMessageId: 'assistant-1',
      conversationTokensIn: 150,
      conversationTokensOut: 42,
    });
    expect(toolLlmRouter.runTurn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        providerContinuation: {
          openai: {
            previousResponseId: 'resp-1',
          },
        },
        messages: [
          expect.objectContaining({
            role: 'tool',
            toolCallId: 'call-1',
            toolName: 'generate_experience',
          }),
        ],
      }),
    );
    expect(repository.recordRunProviderTrace).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        providerRequestRaw: expect.objectContaining({
          _montiTrace: expect.objectContaining({
            tool_operation: 'generate',
          }),
        }),
        providerResponseRaw: expect.objectContaining({
          _montiTrace: expect.objectContaining({
            tool_operation: 'generate',
          }),
        }),
      }),
    );
  });

  it('fails the run when tool-call rounds exceed configured guardrails', async () => {
    const repository = {
      markRunRunning: jest.fn(async () => undefined),
      hydrateThread: jest.fn(async () => ({
        thread: { id: 'thread-1' },
        messages: [
          {
            id: 'message-1',
            thread_id: 'thread-1',
            user_id: 'client-1',
            role: 'user',
            content: 'Keep going forever',
            content_json: null,
          },
        ],
        sandboxState: { thread_id: 'thread-1', status: 'empty' },
        activeRun: null,
        activeToolInvocation: null,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
      createToolInvocation: jest.fn(async () => ({
        id: 'tool-1',
        tool_name: 'generate_experience',
      })),
      markToolInvocationSucceeded: jest.fn(async () => undefined),
      markToolInvocationFailed: jest.fn(async () => undefined),
      findExperienceVersionByGenerationId: jest.fn(async () => ({
        experienceId: 'exp-1',
        versionId: 'ver-1',
      })),
      updateSandboxState: jest.fn(async () => undefined),
      createAssistantMessage: jest.fn(async (input?: { content?: string; contentJson?: Record<string, unknown> | null }) =>
        createAssistantMessage({
          content: input?.content ?? 'Calling tool again.',
          content_json: input?.contentJson ?? null,
        }),
      ),
      markRunSucceeded: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      getRunById: jest.fn(async () =>
        createRun({
          status: 'failed',
          error_code: 'INTERNAL_ERROR',
          error_message: 'Conversation loop exceeded configured tool-call rounds.',
        }),
      ),
    };

    const events = {
      publish: jest.fn(),
    };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => [
        {
          name: 'generate_experience',
          description: 'generate',
          inputSchema: { type: 'object' },
        },
      ]),
      hasTool: jest.fn(() => true),
      executeToolCall: jest.fn(async () => ({
        toolName: 'generate_experience',
        toolCallId: 'call-1',
        result: {
          status: 'succeeded' as const,
          generationId: 'gen-1',
          experienceId: null,
          experienceVersionId: null,
          errorCode: null,
          errorMessage: null,
          sandboxStatus: 'ready' as const,
          route: {
            tier: 'fast' as const,
            confidence: 0.8,
            reason: 'simple request',
            fallbackReason: null,
            selectedProvider: 'openai' as const,
            selectedModel: 'gpt-5-mini',
          },
        },
      })),
    };

    const toolLlmRouter = {
      runTurn: jest.fn(async () => ({
        provider: 'openai' as const,
        model: 'gpt-5.4',
        assistantText: 'Calling tool again.',
        toolCalls: [
          {
            id: 'call-1',
            name: 'generate_experience',
            arguments: { operation: 'generate', prompt: 'Retry forever' },
          },
        ],
        finishReason: 'tool_calls' as const,
        usage: observedUsage({
          inputTokens: 55,
          outputTokens: 14,
        }),
        rawRequest: {},
        rawResponse: {},
      })),
    };

    const llmConfig = {
      conversationProvider: 'openai' as const,
      conversationModel: 'gpt-5.4',
      conversationMaxTokens: 2048,
      conversationMaxToolRounds: 1,
      conversationSystemPrompt: 'You are Monti',
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
    );

    const result = await service.executeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      userMessage: {
        id: 'message-1',
        thread_id: 'thread-1',
        user_id: 'client-1',
        role: 'user',
        content: 'Loop',
        content_json: null,
        idempotency_key: null,
        created_at: new Date().toISOString(),
      },
      run: createRun(),
    });

    expect(result.status).toBe('failed');
    expect(repository.markRunFailed).toHaveBeenCalledTimes(1);
    expect(repository.markRunFailed).toHaveBeenCalledWith({
      runId: 'run-1',
      errorCode: 'INTERNAL_ERROR',
      errorMessage: 'Conversation loop exceeded configured tool-call rounds.',
      conversationTokensIn: 110,
      conversationTokensOut: 28,
    });
  });

  it('leaves conversation token totals unavailable when any completed round lacks usage', async () => {
    const repository = {
      markRunRunning: jest.fn(async () => undefined),
      hydrateThread: jest.fn(async () => ({
        thread: { id: 'thread-1' },
        messages: [
          {
            id: 'message-1',
            thread_id: 'thread-1',
            user_id: 'client-1',
            role: 'user',
            content: 'Build a quiz',
            content_json: null,
          },
        ],
        sandboxState: { thread_id: 'thread-1', status: 'empty' },
        activeRun: null,
        activeToolInvocation: null,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
      createToolInvocation: jest.fn(async () => ({
        id: 'tool-1',
        tool_name: 'generate_experience',
      })),
      markToolInvocationSucceeded: jest.fn(async () => undefined),
      markToolInvocationFailed: jest.fn(async () => undefined),
      findExperienceVersionByGenerationId: jest.fn(async () => ({
        experienceId: 'exp-1',
        versionId: 'ver-1',
      })),
      updateSandboxState: jest.fn(async () => undefined),
      createAssistantMessage: jest.fn(async (input?: { content?: string; contentJson?: Record<string, unknown> | null }) =>
        createAssistantMessage({
          content: input?.content ?? 'Building now.',
          content_json: input?.contentJson ?? null,
        }),
      ),
      markRunSucceeded: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      getRunById: jest.fn(async () =>
        createRun({
          status: 'succeeded',
          assistant_message_id: 'assistant-1',
        }),
      ),
    };

    const events = {
      publish: jest.fn(),
    };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => [
        {
          name: 'generate_experience',
          description: 'generate',
          inputSchema: { type: 'object' },
        },
      ]),
      hasTool: jest.fn(() => true),
      executeToolCall: jest.fn(async () => ({
        toolName: 'generate_experience',
        toolCallId: 'call-1',
        result: {
          status: 'succeeded' as const,
          generationId: 'gen-1',
          experienceId: null,
          experienceVersionId: null,
          errorCode: null,
          errorMessage: null,
          sandboxStatus: 'ready' as const,
          route: {
            tier: 'fast' as const,
            confidence: 0.8,
            reason: 'simple request',
            fallbackReason: null,
            selectedProvider: 'openai' as const,
            selectedModel: 'gpt-5-mini',
          },
        },
      })),
    };

    const toolLlmRouter = {
      runTurn: jest
        .fn()
        .mockResolvedValueOnce({
          provider: 'openai' as const,
          model: 'gpt-5.4',
          assistantText: 'Building now.',
          toolCalls: [
            {
              id: 'call-1',
              name: 'generate_experience',
              arguments: { operation: 'generate', prompt: 'Build a quiz' },
            },
          ],
          finishReason: 'tool_calls' as const,
          usage: observedUsage({
            inputTokens: 90,
            outputTokens: 25,
          }),
          providerContinuation: {
            openai: {
              previousResponseId: 'resp-1',
            },
          },
          rawRequest: {},
          rawResponse: {},
        })
        .mockResolvedValueOnce({
          provider: 'openai' as const,
          model: 'gpt-5.4',
          assistantText: 'Experience generated.',
          toolCalls: [],
          finishReason: 'stop' as const,
          usage: unavailableUsage(),
          rawRequest: {},
          rawResponse: {},
        }),
    };

    const llmConfig = {
      conversationProvider: 'openai' as const,
      conversationModel: 'gpt-5.4',
      conversationMaxTokens: 2048,
      conversationMaxToolRounds: 3,
      conversationSystemPrompt: 'You are Monti',
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
    );

    await service.executeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      userMessage: {
        id: 'message-1',
        thread_id: 'thread-1',
        user_id: 'client-1',
        role: 'user',
        content: 'Build a quiz',
        content_json: null,
        idempotency_key: null,
        created_at: new Date().toISOString(),
      },
      run: createRun(),
    });

    expect(repository.markRunSucceeded).toHaveBeenCalledWith({
      runId: 'run-1',
      assistantMessageId: 'assistant-1',
      conversationTokensIn: null,
      conversationTokensOut: null,
    });
  });
});
