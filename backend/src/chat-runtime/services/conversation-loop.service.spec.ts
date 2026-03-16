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
    error_code: null,
    error_message: null,
    started_at: null,
    completed_at: null,
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
      createAssistantMessage: jest.fn(async () => ({ id: 'assistant-1' })),
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
      runTurn: jest.fn(async () => ({
        provider: 'openai' as const,
        model: 'gpt-5.4',
        assistantText: 'Sure, I can help with that.',
        toolCalls: [],
        finishReason: 'stop' as const,
        rawRequest: {},
        rawResponse: {},
      })),
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
      createAssistantMessage: jest.fn(async () => ({ id: 'assistant-1' })),
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
      createAssistantMessage: jest.fn(async () => ({ id: 'assistant-1' })),
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
  });
});
