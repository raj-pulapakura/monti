import { observedUsage, unavailableUsage } from '../../llm/llm-usage';
import {
  applyConversationMessageWindow,
  ConversationLoopService,
} from './conversation-loop.service';
import { RunAbortRegistryService } from './run-abort-registry.service';

const stubUserProfiles = () => ({
  getByUserId: jest.fn().mockResolvedValue(null),
});

const stubRunAbortRegistry = () => ({
  register: jest.fn(() => new AbortController().signal),
  abort: jest.fn(() => false),
  release: jest.fn(),
  setPreGenerateSandboxSnapshot: jest.fn(),
  getPreGenerateSandboxSnapshot: jest.fn(() => undefined),
});

function getRunByIdForQueuedExecuteTurn(finalRun: Record<string, unknown>) {
  return jest
    .fn()
    .mockResolvedValueOnce(createRun({ status: 'queued' }))
    .mockResolvedValue(createRun(finalRun));
}

function createRun(overrides: Record<string, unknown> = {}) {
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
      getRunById: getRunByIdForQueuedExecuteTurn({
        status: 'succeeded',
        assistant_message_id: 'assistant-1',
      }),
      markRunFailed: jest.fn(async () => undefined),
    };

    const events = {
      publish: jest.fn(),
    };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => []),
      hasTool: jest.fn(() => false),
      getTool: jest.fn(() => undefined),
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
      conversationContextWindowSize: 20,
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      stubUserProfiles() as never,
      stubRunAbortRegistry() as never,
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
      createToolCallMessage: jest.fn(async () =>
        createAssistantMessage({
          id: 'tool-call-msg-1',
          content_json: { toolCalls: [] },
        }),
      ),
      createToolResultMessage: jest.fn(async () =>
        createAssistantMessage({
          id: 'tool-result-msg-1',
          role: 'tool',
          content: '{"status":"succeeded","operation":"generate"}',
        }),
      ),
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
      findSandboxStateRowByThreadId: jest.fn(async () => ({
        status: 'empty',
        experience_id: null,
        experience_version_id: null,
      })),
      createAssistantMessage: jest.fn(async (input?: { content?: string; contentJson?: Record<string, unknown> | null }) =>
        createAssistantMessage({
          content: input?.content ?? 'Building now.',
          content_json: input?.contentJson ?? null,
        }),
      ),
      markRunSucceeded: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      getRunById: getRunByIdForQueuedExecuteTurn({
        status: 'succeeded',
        assistant_message_id: 'assistant-1',
      }),
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
      getTool: jest.fn((name: string) =>
        name === 'generate_experience'
          ? {
              requiresConfirmation: jest.fn(() => false),
              getConfirmationMetadata: jest.fn(() => ({
                operation: 'Generate experience',
                estimatedCredits: { fast: 1, quality: 5 },
              })),
            }
          : undefined,
      ),
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
      conversationContextWindowSize: 20,
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      stubUserProfiles() as never,
      stubRunAbortRegistry() as never,
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
    expect(repository.createToolCallMessage).toHaveBeenCalledTimes(1);
    expect(repository.createToolResultMessage).toHaveBeenCalledTimes(1);
    expect(toolLlmRouter.runTurn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'You are Monti' },
          { role: 'user', content: 'Build a quiz' },
          expect.objectContaining({
            role: 'assistant',
            content: 'Building now.',
            toolCalls: [
              {
                id: 'call-1',
                name: 'generate_experience',
                arguments: { operation: 'generate', prompt: 'Build a quiz' },
              },
            ],
          }),
          expect.objectContaining({
            role: 'tool',
            toolCallId: 'call-1',
            toolName: 'generate_experience',
            content: '{"status":"succeeded","operation":"generate"}',
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
      createToolCallMessage: jest.fn(async () =>
        createAssistantMessage({
          id: 'tool-call-msg-1',
          content_json: { toolCalls: [] },
        }),
      ),
      createToolResultMessage: jest.fn(async () =>
        createAssistantMessage({
          id: 'tool-result-msg-1',
          role: 'tool',
          content: '{"status":"succeeded","operation":"generate"}',
        }),
      ),
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
      findSandboxStateRowByThreadId: jest.fn(async () => ({
        status: 'empty',
        experience_id: null,
        experience_version_id: null,
      })),
      createAssistantMessage: jest.fn(async (input?: { content?: string; contentJson?: Record<string, unknown> | null }) =>
        createAssistantMessage({
          content: input?.content ?? 'Calling tool again.',
          content_json: input?.contentJson ?? null,
        }),
      ),
      markRunSucceeded: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      getRunById: getRunByIdForQueuedExecuteTurn({
        status: 'failed',
        error_code: 'INTERNAL_ERROR',
        error_message: 'Conversation loop exceeded configured tool-call rounds.',
      }),
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
      getTool: jest.fn((name: string) =>
        name === 'generate_experience'
          ? {
              requiresConfirmation: jest.fn(() => false),
              getConfirmationMetadata: jest.fn(() => ({
                operation: 'Generate experience',
                estimatedCredits: { fast: 1, quality: 5 },
              })),
            }
          : undefined,
      ),
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
      conversationContextWindowSize: 20,
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      stubUserProfiles() as never,
      stubRunAbortRegistry() as never,
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
      createToolCallMessage: jest.fn(async () =>
        createAssistantMessage({
          id: 'tool-call-msg-1',
          content_json: { toolCalls: [] },
        }),
      ),
      createToolResultMessage: jest.fn(async () =>
        createAssistantMessage({
          id: 'tool-result-msg-1',
          role: 'tool',
          content: '{"status":"succeeded","operation":"generate"}',
        }),
      ),
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
      findSandboxStateRowByThreadId: jest.fn(async () => ({
        status: 'empty',
        experience_id: null,
        experience_version_id: null,
      })),
      createAssistantMessage: jest.fn(async (input?: { content?: string; contentJson?: Record<string, unknown> | null }) =>
        createAssistantMessage({
          content: input?.content ?? 'Building now.',
          content_json: input?.contentJson ?? null,
        }),
      ),
      markRunSucceeded: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      getRunById: getRunByIdForQueuedExecuteTurn({
        status: 'succeeded',
        assistant_message_id: 'assistant-1',
      }),
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
      getTool: jest.fn((name: string) =>
        name === 'generate_experience'
          ? {
              requiresConfirmation: jest.fn(() => false),
              getConfirmationMetadata: jest.fn(() => ({
                operation: 'Generate experience',
                estimatedCredits: { fast: 1, quality: 5 },
              })),
            }
          : undefined,
      ),
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
      conversationContextWindowSize: 20,
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      stubUserProfiles() as never,
      stubRunAbortRegistry() as never,
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

  it('includes all thread messages when the thread is shorter than the context window', async () => {
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
            content: 'First',
            content_json: null,
          },
          {
            id: 'message-2',
            thread_id: 'thread-1',
            user_id: 'client-1',
            role: 'user',
            content: 'Second',
            content_json: null,
          },
          {
            id: 'message-3',
            thread_id: 'thread-1',
            user_id: 'client-1',
            role: 'user',
            content: 'Third',
            content_json: null,
          },
        ],
        sandboxState: { thread_id: 'thread-1', status: 'empty' },
        activeRun: null,
        activeToolInvocation: null,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
      createAssistantMessage: jest.fn(async () => createAssistantMessage()),
      markRunSucceeded: jest.fn(async () => undefined),
      getRunById: getRunByIdForQueuedExecuteTurn({
        status: 'succeeded',
        assistant_message_id: 'assistant-1',
      }),
      markRunFailed: jest.fn(async () => undefined),
    };

    const events = { publish: jest.fn() };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => []),
      hasTool: jest.fn(() => false),
      getTool: jest.fn(() => undefined),
      executeToolCall: jest.fn(async () => {
        throw new Error('should not be called');
      }),
    };

    const toolLlmRouter = {
      runTurn: jest.fn(async (input: { onAssistantTextSnapshot?: (text: string) => void }) => {
        await input.onAssistantTextSnapshot?.('ok');
        return {
          provider: 'openai' as const,
          model: 'gpt-5.4',
          assistantText: 'ok',
          toolCalls: [],
          finishReason: 'stop' as const,
          usage: observedUsage({ inputTokens: 1, outputTokens: 1 }),
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
      conversationSystemPrompt: 'SYS',
      conversationContextWindowSize: 20,
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      stubUserProfiles() as never,
      stubRunAbortRegistry() as never,
    );

    await service.executeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      userMessage: {
        id: 'message-3',
        thread_id: 'thread-1',
        user_id: 'client-1',
        role: 'user',
        content: 'Third',
        content_json: null,
        idempotency_key: null,
        created_at: new Date().toISOString(),
      },
      run: createRun(),
    });

    const firstRoundMessages = (
      toolLlmRouter.runTurn.mock.calls[0][0] as { messages: unknown[] }
    ).messages;
    expect(firstRoundMessages.slice(0, 4)).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'First' },
      { role: 'user', content: 'Second' },
      { role: 'user', content: 'Third' },
    ]);
  });

  it('sends only the last N non-tool messages when the thread exceeds the context window', async () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({
      id: `message-${i}`,
      thread_id: 'thread-1',
      user_id: 'client-1',
      role: 'user' as const,
      content: `Message ${i}`,
      content_json: null,
    }));

    const repository = {
      markRunRunning: jest.fn(async () => undefined),
      hydrateThread: jest.fn(async () => ({
        thread: { id: 'thread-1' },
        messages,
        sandboxState: { thread_id: 'thread-1', status: 'empty' },
        activeRun: null,
        activeToolInvocation: null,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
      createAssistantMessage: jest.fn(async () => createAssistantMessage()),
      markRunSucceeded: jest.fn(async () => undefined),
      getRunById: getRunByIdForQueuedExecuteTurn({
        status: 'succeeded',
        assistant_message_id: 'assistant-1',
      }),
      markRunFailed: jest.fn(async () => undefined),
    };

    const events = { publish: jest.fn() };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => []),
      hasTool: jest.fn(() => false),
      getTool: jest.fn(() => undefined),
      executeToolCall: jest.fn(async () => {
        throw new Error('should not be called');
      }),
    };

    const toolLlmRouter = {
      runTurn: jest.fn(async (input: { onAssistantTextSnapshot?: (text: string) => void }) => {
        await input.onAssistantTextSnapshot?.('ok');
        return {
          provider: 'openai' as const,
          model: 'gpt-5.4',
          assistantText: 'ok',
          toolCalls: [],
          finishReason: 'stop' as const,
          usage: observedUsage({ inputTokens: 1, outputTokens: 1 }),
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
      conversationSystemPrompt: 'SYS',
      conversationContextWindowSize: 5,
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      stubUserProfiles() as never,
      stubRunAbortRegistry() as never,
    );

    await service.executeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      userMessage: {
        id: 'message-24',
        thread_id: 'thread-1',
        user_id: 'client-1',
        role: 'user',
        content: 'Message 24',
        content_json: null,
        idempotency_key: null,
        created_at: new Date().toISOString(),
      },
      run: createRun(),
    });

    const firstRoundMessages = (
      toolLlmRouter.runTurn.mock.calls[0][0] as { messages: unknown[] }
    ).messages;
    expect(firstRoundMessages.slice(0, 6)).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'Message 20' },
      { role: 'user', content: 'Message 21' },
      { role: 'user', content: 'Message 22' },
      { role: 'user', content: 'Message 23' },
      { role: 'user', content: 'Message 24' },
    ]);
  });

  it('pauses before tool execution when the chat tool requires confirmation', async () => {
    const markRunAwaitingConfirmation = jest.fn(async () => undefined);
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
      createToolCallMessage: jest.fn(async () =>
        createAssistantMessage({
          id: 'tool-call-msg-1',
          content_json: { toolCalls: [] },
        }),
      ),
      createToolInvocation: jest.fn(async () => ({
        id: 'tool-inv-1',
        tool_name: 'generate_experience',
      })),
      markRunAwaitingConfirmation,
      markRunSucceeded: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      getRunById: jest
        .fn()
        .mockResolvedValueOnce(createRun({ status: 'queued' }))
        .mockResolvedValue(
          createRun({
            status: 'awaiting_confirmation',
            confirmation_tool_call_id: 'call-1',
            confirmation_metadata: {
              operation: 'Generate experience',
              estimatedCredits: { fast: 1, quality: 5 },
            },
          }),
        ),
    };

    const events = {
      publish: jest.fn(),
    };

    const requiresConfirmation = jest.fn(() => true);
    const toolRegistry = {
      getToolDefinitions: jest.fn(() => [
        { name: 'generate_experience', description: 'generate', inputSchema: { type: 'object' } },
      ]),
      hasTool: jest.fn(() => true),
      getTool: jest.fn(() => ({
        requiresConfirmation,
        getConfirmationMetadata: jest.fn(() => ({
          operation: 'Generate experience',
          estimatedCredits: { fast: 1, quality: 5 },
        })),
      })),
      executeToolCall: jest.fn(async () => {
        throw new Error('executeToolCall should not run while awaiting confirmation');
      }),
    };

    const toolLlmRouter = {
      runTurn: jest.fn(async () => ({
        provider: 'openai' as const,
        model: 'gpt-5.4',
        assistantText: 'Building.',
        toolCalls: [
          {
            id: 'call-1',
            name: 'generate_experience',
            arguments: { operation: 'generate', prompt: 'Build a quiz' },
          },
        ],
        finishReason: 'tool_calls' as const,
        usage: observedUsage({ inputTokens: 10, outputTokens: 5 }),
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
      conversationContextWindowSize: 20,
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      stubUserProfiles() as never,
      stubRunAbortRegistry() as never,
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

    expect(result.status).toBe('awaiting_confirmation');
    expect(markRunAwaitingConfirmation).toHaveBeenCalledWith({
      runId: 'run-1',
      confirmationToolCallId: 'call-1',
      confirmationMetadata: {
        operation: 'Generate experience',
        estimatedCredits: { fast: 1, quality: 5 },
      },
    });
    expect(requiresConfirmation).toHaveBeenCalled();
    expect(toolRegistry.executeToolCall).not.toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'confirmation_required',
        payload: expect.objectContaining({
          toolCallId: 'call-1',
          operation: 'Generate experience',
          estimatedCredits: { fast: 1, quality: 5 },
        }),
      }),
    );
  });

  it('resumeTurn (confirmed) executes the pending tool with the selected quality mode', async () => {
    const assistantToolRow = {
      id: 'assistant-tool-msg',
      thread_id: 'thread-1',
      user_id: 'client-1',
      role: 'assistant' as const,
      content: 'Building.',
      content_json: {
        toolCalls: [
          {
            id: 'call-1',
            name: 'generate_experience',
            arguments: { operation: 'generate', prompt: 'Build a quiz' },
          },
        ],
      },
      idempotency_key: null,
      created_at: new Date().toISOString(),
    };

    const repository = {
      assertThreadAccess: jest.fn(async () => undefined),
      markRunRunningFromConfirmation: jest.fn(async () => undefined),
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
          assistantToolRow,
        ],
        sandboxState: { thread_id: 'thread-1', status: 'empty' },
        activeRun: null,
        activeToolInvocation: null,
      })),
      createToolInvocation: jest.fn(async () => ({
        id: 'tool-inv-resume',
        tool_name: 'generate_experience',
      })),
      markToolInvocationSucceeded: jest.fn(async () => undefined),
      markToolInvocationFailed: jest.fn(async () => undefined),
      findExperienceVersionByGenerationId: jest.fn(async () => ({
        experienceId: 'exp-1',
        versionId: 'ver-1',
      })),
      updateSandboxState: jest.fn(async () => undefined),
      findSandboxStateRowByThreadId: jest.fn(async () => ({
        status: 'empty',
        experience_id: null,
        experience_version_id: null,
      })),
      createToolResultMessage: jest.fn(async () =>
        createAssistantMessage({
          id: 'tool-result-msg',
          role: 'tool',
          content: '{"status":"succeeded","operation":"generate"}',
        }),
      ),
      recordRunProviderTrace: jest.fn(async () => undefined),
      createAssistantMessage: jest.fn(async (input?: { content?: string; contentJson?: Record<string, unknown> | null }) =>
        createAssistantMessage({
          content: input?.content ?? 'Done.',
          content_json: input?.contentJson ?? null,
        }),
      ),
      createToolCallMessage: jest.fn(async () => createAssistantMessage({ id: 'noop-tool-call' })),
      markRunSucceeded: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      getRunById: jest
        .fn()
        .mockResolvedValueOnce(
          createRun({
            status: 'awaiting_confirmation',
            confirmation_tool_call_id: 'call-1',
            confirmation_metadata: {
              operation: 'Generate experience',
              estimatedCredits: { fast: 1, quality: 5 },
            },
            provider_response_raw: { _montiTrace: { round: 0 } },
          }),
        )
        .mockResolvedValue(
          createRun({
            status: 'succeeded',
            assistant_message_id: 'assistant-1',
            provider_response_raw: { _montiTrace: { round: 0 } },
          }),
        ),
    };

    const events = {
      publish: jest.fn(),
    };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => [
        { name: 'generate_experience', description: 'generate', inputSchema: { type: 'object' } },
      ]),
      hasTool: jest.fn(() => true),
      getTool: jest.fn(() => ({
        requiresConfirmation: jest.fn(() => true),
        getConfirmationMetadata: jest.fn(() => ({
          operation: 'Generate experience',
          estimatedCredits: { fast: 1, quality: 5 },
        })),
      })),
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
            tier: 'quality' as const,
            confidence: 0.9,
            reason: 'user choice',
            fallbackReason: null,
            selectedProvider: 'openai' as const,
            selectedModel: 'gpt-5.4',
          },
        },
      })),
    };

    const toolLlmRouter = {
      runTurn: jest.fn(async () => ({
        provider: 'openai' as const,
        model: 'gpt-5.4',
        assistantText: 'All set.',
        toolCalls: [],
        finishReason: 'stop' as const,
        usage: observedUsage({ inputTokens: 40, outputTokens: 12 }),
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
      conversationContextWindowSize: 20,
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      stubUserProfiles() as never,
      stubRunAbortRegistry() as never,
    );

    const result = await service.resumeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      runId: 'run-1',
      confirmedToolCallId: 'call-1',
      decision: 'confirmed',
      qualityMode: 'quality',
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
    });

    expect(result.status).toBe('succeeded');
    expect(toolRegistry.executeToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedQualityMode: 'quality',
        toolCallId: 'call-1',
      }),
    );
    expect(repository.createToolResultMessage).toHaveBeenCalled();
    expect(repository.markRunSucceeded).toHaveBeenCalled();
  });

  it('resumeTurn (cancelled) writes a cancelled tool result and completes the assistant turn', async () => {
    const assistantToolRow = {
      id: 'assistant-tool-msg',
      thread_id: 'thread-1',
      user_id: 'client-1',
      role: 'assistant' as const,
      content: 'Building.',
      content_json: {
        toolCalls: [
          {
            id: 'call-1',
            name: 'generate_experience',
            arguments: { operation: 'generate', prompt: 'Build a quiz' },
          },
        ],
      },
      idempotency_key: null,
      created_at: new Date().toISOString(),
    };

    const repository = {
      assertThreadAccess: jest.fn(async () => undefined),
      markRunRunningFromConfirmation: jest.fn(async () => undefined),
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
          assistantToolRow,
        ],
        sandboxState: { thread_id: 'thread-1', status: 'empty' },
        activeRun: null,
        activeToolInvocation: null,
      })),
      findToolInvocationByRunAndProviderToolCallId: jest.fn(async () => ({
        id: 'tool-inv-1',
        tool_name: 'generate_experience',
      })),
      markToolInvocationFailed: jest.fn(async () => undefined),
      createToolResultMessage: jest.fn(async () =>
        createAssistantMessage({
          id: 'tool-cancel-msg',
          role: 'tool',
          content: '{"status":"cancelled","operation":"generate"}',
        }),
      ),
      recordRunProviderTrace: jest.fn(async () => undefined),
      createAssistantMessage: jest.fn(async (input?: { content?: string; contentJson?: Record<string, unknown> | null }) =>
        createAssistantMessage({
          content: input?.content ?? 'No problem.',
          content_json: input?.contentJson ?? null,
        }),
      ),
      createToolCallMessage: jest.fn(async () => createAssistantMessage({ id: 'noop-tool-call' })),
      markRunSucceeded: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      getRunById: jest
        .fn()
        .mockResolvedValueOnce(
          createRun({
            status: 'awaiting_confirmation',
            confirmation_tool_call_id: 'call-1',
            confirmation_metadata: {
              operation: 'Generate experience',
              estimatedCredits: { fast: 1, quality: 5 },
            },
            provider_response_raw: { _montiTrace: { round: 0 } },
          }),
        )
        .mockResolvedValue(
          createRun({
            status: 'succeeded',
            assistant_message_id: 'assistant-1',
            provider_response_raw: { _montiTrace: { round: 0 } },
          }),
        ),
    };

    const events = {
      publish: jest.fn(),
    };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => []),
      hasTool: jest.fn(() => false),
      getTool: jest.fn(() => undefined),
      executeToolCall: jest.fn(async () => {
        throw new Error('executeToolCall should not run on cancel');
      }),
    };

    const toolLlmRouter = {
      runTurn: jest.fn(async () => ({
        provider: 'openai' as const,
        model: 'gpt-5.4',
        assistantText: 'Cancelled as requested.',
        toolCalls: [],
        finishReason: 'stop' as const,
        usage: observedUsage({ inputTokens: 20, outputTokens: 8 }),
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
      conversationContextWindowSize: 20,
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      stubUserProfiles() as never,
      stubRunAbortRegistry() as never,
    );

    const result = await service.resumeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      runId: 'run-1',
      confirmedToolCallId: 'call-1',
      decision: 'cancelled',
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
    });

    expect(result.status).toBe('succeeded');
    expect(toolRegistry.executeToolCall).not.toHaveBeenCalled();
    expect(repository.createToolResultMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: 'call-1',
        content: '{"status":"cancelled","operation":"generate"}',
      }),
    );
    expect(repository.markRunSucceeded).toHaveBeenCalled();
  });

  it('pauses twice when two tool calls in one batch each require confirmation', async () => {
    const markRunAwaitingConfirmation = jest.fn(async () => undefined);
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
            content: 'Do two things',
            content_json: null,
          },
        ],
        sandboxState: { thread_id: 'thread-1', status: 'empty' },
        activeRun: null,
        activeToolInvocation: null,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
      createToolCallMessage: jest.fn(async () =>
        createAssistantMessage({
          id: 'tool-call-msg-1',
          content_json: { toolCalls: [] },
        }),
      ),
      createToolInvocation: jest.fn(async ({ providerToolCallId }: { providerToolCallId: string }) => ({
        id: `inv-${providerToolCallId}`,
        tool_name: 'generate_experience',
      })),
      markRunAwaitingConfirmation,
      markRunSucceeded: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      assertThreadAccess: jest.fn(async () => undefined),
      markRunRunningFromConfirmation: jest.fn(async () => undefined),
      createToolResultMessage: jest.fn(async () =>
        createAssistantMessage({
          id: 'tool-result-msg',
          role: 'tool',
          content: '{"status":"succeeded","operation":"generate"}',
        }),
      ),
      markToolInvocationSucceeded: jest.fn(async () => undefined),
      markToolInvocationFailed: jest.fn(async () => undefined),
      findExperienceVersionByGenerationId: jest.fn(async () => ({
        experienceId: 'exp-1',
        versionId: 'ver-1',
      })),
      updateSandboxState: jest.fn(async () => undefined),
      findSandboxStateRowByThreadId: jest.fn(async () => ({
        status: 'empty',
        experience_id: null,
        experience_version_id: null,
      })),
      createAssistantMessage: jest.fn(async (input?: { content?: string; contentJson?: Record<string, unknown> | null }) =>
        createAssistantMessage({
          content: input?.content ?? 'Done.',
          content_json: input?.contentJson ?? null,
        }),
      ),
      getRunById: jest.fn(),
    };

    let sequentialGetRunCall = 0;
    (repository.getRunById as jest.Mock).mockImplementation(async () => {
      sequentialGetRunCall += 1;
      const meta = {
        operation: 'Generate experience',
        estimatedCredits: { fast: 1, quality: 5 },
      };
      if (sequentialGetRunCall === 1) {
        return createRun({ status: 'queued' });
      }
      if (sequentialGetRunCall === 2) {
        return createRun({
          status: 'awaiting_confirmation',
          confirmation_tool_call_id: 'call-a',
          confirmation_metadata: meta,
        });
      }
      if (sequentialGetRunCall === 3) {
        return createRun({
          status: 'awaiting_confirmation',
          confirmation_tool_call_id: 'call-a',
          confirmation_metadata: meta,
        });
      }
      if (sequentialGetRunCall === 4) {
        return createRun({
          status: 'awaiting_confirmation',
          confirmation_tool_call_id: 'call-b',
          confirmation_metadata: meta,
          provider_response_raw: { _montiTrace: { round: 0 } },
        });
      }
      if (sequentialGetRunCall === 5) {
        return createRun({
          status: 'awaiting_confirmation',
          confirmation_tool_call_id: 'call-b',
          confirmation_metadata: meta,
        });
      }
      if (sequentialGetRunCall === 6) {
        return createRun({
          status: 'running',
          confirmation_tool_call_id: null,
          confirmation_metadata: null,
          provider_response_raw: { _montiTrace: { round: 0 } },
        });
      }
      return createRun({
        status: 'succeeded',
        assistant_message_id: 'assistant-1',
        provider_response_raw: { _montiTrace: { round: 1 } },
      });
    });

    const events = {
      publish: jest.fn(),
    };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => [
        { name: 'generate_experience', description: 'generate', inputSchema: { type: 'object' } },
      ]),
      hasTool: jest.fn(() => true),
      getTool: jest.fn(() => ({
        requiresConfirmation: jest.fn(() => true),
        getConfirmationMetadata: jest.fn(() => ({
          operation: 'Generate experience',
          estimatedCredits: { fast: 1, quality: 5 },
        })),
      })),
      executeToolCall: jest.fn(async () => ({
        toolName: 'generate_experience',
        toolCallId: 'call-a',
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
            reason: 'simple',
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
          assistantText: 'Two steps.',
          toolCalls: [
            {
              id: 'call-a',
              name: 'generate_experience',
              arguments: { operation: 'generate', prompt: 'First' },
            },
            {
              id: 'call-b',
              name: 'generate_experience',
              arguments: { operation: 'generate', prompt: 'Second' },
            },
          ],
          finishReason: 'tool_calls' as const,
          usage: observedUsage({ inputTokens: 12, outputTokens: 6 }),
          rawRequest: {},
          rawResponse: {},
        })
        .mockResolvedValue({
          provider: 'openai' as const,
          model: 'gpt-5.4',
          assistantText: 'Finished both.',
          toolCalls: [],
          finishReason: 'stop' as const,
          usage: observedUsage({ inputTokens: 30, outputTokens: 10 }),
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
      conversationContextWindowSize: 20,
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      stubUserProfiles() as never,
      stubRunAbortRegistry() as never,
    );

    const first = await service.executeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      userMessage: {
        id: 'message-1',
        thread_id: 'thread-1',
        user_id: 'client-1',
        role: 'user',
        content: 'Do two things',
        content_json: null,
        idempotency_key: null,
        created_at: new Date().toISOString(),
      },
      run: createRun(),
    });
    expect(first.confirmation_tool_call_id).toBe('call-a');
    expect(markRunAwaitingConfirmation).toHaveBeenNthCalledWith(1, {
      runId: 'run-1',
      confirmationToolCallId: 'call-a',
      confirmationMetadata: {
        operation: 'Generate experience',
        estimatedCredits: { fast: 1, quality: 5 },
      },
    });

    const assistantAfterFirstPause = {
      id: 'assistant-dual',
      thread_id: 'thread-1',
      user_id: 'client-1',
      role: 'assistant' as const,
      content: 'Two steps.',
      content_json: {
        toolCalls: [
          {
            id: 'call-a',
            name: 'generate_experience',
            arguments: { operation: 'generate', prompt: 'First' },
          },
          {
            id: 'call-b',
            name: 'generate_experience',
            arguments: { operation: 'generate', prompt: 'Second' },
          },
        ],
      },
      idempotency_key: null,
      created_at: new Date().toISOString(),
    };

    (repository.hydrateThread as jest.Mock).mockResolvedValue({
      thread: { id: 'thread-1' },
      messages: [
        {
          id: 'message-1',
          thread_id: 'thread-1',
          user_id: 'client-1',
          role: 'user',
          content: 'Do two things',
          content_json: null,
        },
        assistantAfterFirstPause,
      ],
      sandboxState: { thread_id: 'thread-1', status: 'empty' },
      activeRun: null,
      activeToolInvocation: null,
    });

    const mid = await service.resumeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      runId: 'run-1',
      confirmedToolCallId: 'call-a',
      decision: 'confirmed',
      qualityMode: 'fast',
      userMessage: {
        id: 'message-1',
        thread_id: 'thread-1',
        user_id: 'client-1',
        role: 'user',
        content: 'Do two things',
        content_json: null,
        idempotency_key: null,
        created_at: new Date().toISOString(),
      },
    });
    expect(mid.confirmation_tool_call_id).toBe('call-b');
    expect(markRunAwaitingConfirmation).toHaveBeenNthCalledWith(2, {
      runId: 'run-1',
      confirmationToolCallId: 'call-b',
      confirmationMetadata: {
        operation: 'Generate experience',
        estimatedCredits: { fast: 1, quality: 5 },
      },
    });
    expect(toolRegistry.executeToolCall).toHaveBeenCalledTimes(1);

    (repository.hydrateThread as jest.Mock).mockResolvedValue({
      thread: { id: 'thread-1' },
      messages: [
        {
          id: 'message-1',
          thread_id: 'thread-1',
          user_id: 'client-1',
          role: 'user',
          content: 'Do two things',
          content_json: null,
        },
        assistantAfterFirstPause,
        {
          id: 'tool-result-a',
          thread_id: 'thread-1',
          user_id: 'client-1',
          role: 'tool',
          content: '{"status":"succeeded","operation":"generate"}',
          content_json: { toolCallId: 'call-a', toolName: 'generate_experience' },
        },
      ],
      sandboxState: { thread_id: 'thread-1', status: 'empty' },
      activeRun: null,
      activeToolInvocation: null,
    });

    await service.resumeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      runId: 'run-1',
      confirmedToolCallId: 'call-b',
      decision: 'confirmed',
      qualityMode: 'fast',
      userMessage: {
        id: 'message-1',
        thread_id: 'thread-1',
        user_id: 'client-1',
        role: 'user',
        content: 'Do two things',
        content_json: null,
        idempotency_key: null,
        created_at: new Date().toISOString(),
      },
    });

    expect(toolRegistry.executeToolCall).toHaveBeenCalledTimes(2);
    expect(repository.markRunSucceeded).toHaveBeenCalled();
  });

  it('prepends completed user profile to the system prompt for the model turn', async () => {
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
            content: 'Hi',
            content_json: null,
          },
        ],
        sandboxState: { thread_id: 'thread-1', status: 'empty' },
        activeRun: null,
        activeToolInvocation: null,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
      createAssistantMessage: jest.fn(async () =>
        createAssistantMessage({ content: 'ok' }),
      ),
      markRunSucceeded: jest.fn(async () => undefined),
      getRunById: getRunByIdForQueuedExecuteTurn({
        status: 'succeeded',
        assistant_message_id: 'assistant-1',
      }),
      markRunFailed: jest.fn(async () => undefined),
    };

    const events = { publish: jest.fn() };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => []),
      hasTool: jest.fn(() => false),
      getTool: jest.fn(() => undefined),
      executeToolCall: jest.fn(async () => {
        throw new Error('should not be called');
      }),
    };

    const toolLlmRouter = {
      runTurn: jest.fn(async () => ({
        provider: 'openai' as const,
        model: 'gpt-5.4',
        assistantText: 'ok',
        toolCalls: [],
        finishReason: 'stop' as const,
        usage: observedUsage({ inputTokens: 10, outputTokens: 2 }),
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
      conversationContextWindowSize: 20,
    };

    const userProfiles = {
      getByUserId: jest.fn().mockResolvedValue({
        user_id: 'client-1',
        role: 'educator' as const,
        context: 'k12_elementary' as const,
        role_other_text: 'DROP TABLE students;--',
        onboarding_completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      userProfiles as never,
      stubRunAbortRegistry() as never,
    );

    await service.executeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      userMessage: {
        id: 'message-1',
        thread_id: 'thread-1',
        user_id: 'client-1',
        role: 'user',
        content: 'Hi',
        content_json: null,
        idempotency_key: null,
        created_at: new Date().toISOString(),
      },
      run: createRun(),
    });

    expect(toolLlmRouter.runTurn).toHaveBeenCalled();
    const runTurnMock = toolLlmRouter.runTurn as jest.Mock;
    const firstArg = runTurnMock.mock.calls[0][0] as unknown as {
      messages: { role: string; content: string }[];
    };
    expect(firstArg.messages[0]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('User context:'),
    });
    expect(firstArg.messages[0].content).toContain('You are Monti');
    expect(firstArg.messages[0].content).not.toContain('DROP TABLE');
  });

  it('routes AbortError through handleCancelledRun: partial text, run_cancelled, markRunCancelled', async () => {
    const runAbortRegistry = new RunAbortRegistryService();
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
            content: 'Hi',
            content_json: null,
          },
        ],
        sandboxState: { thread_id: 'thread-1', status: 'empty' },
        activeRun: null,
        activeToolInvocation: null,
      })),
      recordRunProviderTrace: jest.fn(async () => undefined),
      createAssistantMessage: jest.fn(async () =>
        createAssistantMessage({ id: 'assistant-partial', content: 'Partial' }),
      ),
      markRunCancelled: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      markRunSucceeded: jest.fn(async () => undefined),
      findRunningToolInvocationForRun: jest.fn(async () => null),
      findSandboxStateRowByThreadId: jest.fn(async () => ({ status: 'empty' })),
      getRunById: jest
        .fn()
        .mockResolvedValueOnce(createRun({ status: 'queued' }))
        .mockResolvedValue(
          createRun({
            status: 'cancelled',
            assistant_message_id: 'assistant-partial',
          }),
        ),
    };

    const events = { publish: jest.fn() };

    const toolRegistry = {
      getToolDefinitions: jest.fn(() => []),
      hasTool: jest.fn(() => false),
      getTool: jest.fn(() => undefined),
      executeToolCall: jest.fn(async () => {
        throw new Error('should not be called');
      }),
    };

    const toolLlmRouter = {
      runTurn: jest.fn(
        async (input: {
          onAssistantTextSnapshot?: (text: string) => void | Promise<void>;
        }) => {
          await input.onAssistantTextSnapshot?.('Partial');
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        },
      ),
    };

    const llmConfig = {
      conversationProvider: 'openai' as const,
      conversationModel: 'gpt-5.4',
      conversationMaxTokens: 2048,
      conversationMaxToolRounds: 3,
      conversationSystemPrompt: 'You are Monti',
      conversationContextWindowSize: 20,
    };

    const service = new ConversationLoopService(
      repository as never,
      events as never,
      toolRegistry as never,
      toolLlmRouter as never,
      llmConfig as never,
      stubUserProfiles() as never,
      runAbortRegistry,
    );

    const result = await service.executeTurn({
      threadId: 'thread-1',
      userId: 'client-1',
      userMessage: {
        id: 'message-1',
        thread_id: 'thread-1',
        user_id: 'client-1',
        role: 'user',
        content: 'Hi',
        content_json: null,
        idempotency_key: null,
        created_at: new Date().toISOString(),
      },
      run: createRun(),
    });

    expect(result.status).toBe('cancelled');
    expect(repository.markRunCancelled).toHaveBeenCalledTimes(1);
    expect(repository.markRunFailed).not.toHaveBeenCalled();
    expect(repository.createAssistantMessage).toHaveBeenCalled();
    const publishedTypes = (events.publish as jest.Mock).mock.calls.map(
      (call: [{ type: string }]) => call[0].type,
    );
    expect(publishedTypes).toContain('assistant_message_created');
    expect(publishedTypes).toContain('run_cancelled');
  });

  it('snaps the context window to a preceding user message when the slice would start on a tool turn', () => {
    const messages = [
      { role: 'user' as const, content: 'first' },
      {
        role: 'assistant' as const,
        content: 'calling',
        toolCalls: [{ id: 'call-1', name: 'generate_experience', arguments: { operation: 'generate' } }],
      },
      {
        role: 'tool' as const,
        content: '{"status":"succeeded","operation":"generate"}',
        toolCallId: 'call-1',
        toolName: 'generate_experience',
      },
    ];

    const windowed = applyConversationMessageWindow(messages, 1);
    expect(windowed).toEqual(messages);
  });
});
