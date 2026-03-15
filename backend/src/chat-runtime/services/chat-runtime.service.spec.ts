import { AppError } from '../../common/errors/app-error';
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
    client_id: 'client-1',
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
    process.env.NATIVE_TOOL_LOOP_ENABLED = 'true';
    process.env.ROUTER_STAGE_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.CHAT_RUNTIME_ENABLED;
    delete process.env.NATIVE_TOOL_LOOP_ENABLED;
    delete process.env.ROUTER_STAGE_ENABLED;
  });

  it('executes end-to-end submit flow from message to run completion', async () => {
    const repository = {
      submitUserMessage: jest.fn(async () => ({
        message: createMessageRow(),
        run: createRunRow(),
        deduplicated: false,
      })),
      recordRunRoutingDecision: jest.fn(async () => undefined),
      getRunById: jest
        .fn()
        .mockResolvedValueOnce(
          createRunRow({
            router_tier: 'fast',
            provider: 'openai',
            model: 'gpt-5-mini',
          }),
        )
        .mockResolvedValueOnce(
          createRunRow({
            status: 'succeeded',
            router_tier: 'fast',
            provider: 'openai',
            model: 'gpt-5-mini',
            assistant_message_id: 'assistant-1',
          }),
        ),
      markRunRunning: jest.fn(async () => undefined),
      updateSandboxState: jest.fn(async () => undefined),
      createToolInvocation: jest.fn(async () => ({ id: 'invocation-1', tool_name: 'generate_experience' })),
      markToolInvocationSucceeded: jest.fn(async () => undefined),
      findExperienceVersionByGenerationId: jest.fn(async () => ({ experienceId: 'exp-1', versionId: 'ver-1' })),
      createAssistantMessage: jest.fn(async () => ({ id: 'assistant-1' })),
      markRunSucceeded: jest.fn(async () => undefined),
      markToolInvocationFailed: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
    };

    const decisionRouter = {
      decideRoute: jest.fn(async () => ({
        tier: 'fast' as const,
        confidence: 0.84,
        reason: 'Simple request',
        fallbackReason: null,
        selectedProvider: 'openai' as const,
        selectedModel: 'gpt-5-mini',
      })),
    };

    const toolRegistry = {
      executeGenerateExperience: jest.fn(async () => ({
        toolName: 'generate_experience' as const,
        payload: {
          experience: {
            title: 'Quiz',
            description: 'Desc',
            html: '<main>Quiz</main>',
            css: 'main{}',
            js: 'console.log(1)',
          },
          metadata: {
            generationId: 'generation-1',
            provider: 'openai',
            model: 'gpt-5-mini',
            qualityMode: 'fast',
            maxTokens: 8192,
            renderingContract: {
              iframeOnly: true,
              sandbox: 'allow-scripts',
              networkAccess: 'disallowed',
              externalLibraries: 'disallowed',
            },
          },
        },
      })),
    };

    const events = {
      latestEventId: jest.fn(() => null),
      publish: jest.fn(),
    };

    const service = new ChatRuntimeService(
      repository as never,
      decisionRouter as never,
      toolRegistry as never,
      events as never,
    );

    const result = await service.submitMessage({
      threadId: 'thread-1',
      request: {
        clientId: 'client-1',
        content: 'Build a quiz',
      },
    });

    expect(result.run?.status).toBe('succeeded');
    expect(repository.markRunRunning).toHaveBeenCalledTimes(1);
    expect(repository.markToolInvocationSucceeded).toHaveBeenCalledTimes(1);
    expect(repository.markRunSucceeded).toHaveBeenCalledTimes(1);
    expect(repository.updateSandboxState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'creating' }),
    );
    expect(repository.updateSandboxState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready', experienceId: 'exp-1', experienceVersionId: 'ver-1' }),
    );
  });

  it('normalizes tool execution failures and marks run as failed', async () => {
    const repository = {
      submitUserMessage: jest.fn(async () => ({
        message: createMessageRow(),
        run: createRunRow(),
        deduplicated: false,
      })),
      recordRunRoutingDecision: jest.fn(async () => undefined),
      getRunById: jest
        .fn()
        .mockResolvedValueOnce(
          createRunRow({
            router_tier: 'fast',
            provider: 'openai',
            model: 'gpt-5-mini',
          }),
        )
        .mockResolvedValueOnce(
          createRunRow({
            status: 'failed',
            router_tier: 'fast',
            provider: 'openai',
            model: 'gpt-5-mini',
            error_code: 'PROVIDER_TIMEOUT',
            error_message: 'Provider timed out',
          }),
        ),
      markRunRunning: jest.fn(async () => undefined),
      updateSandboxState: jest.fn(async () => undefined),
      createToolInvocation: jest.fn(async () => ({ id: 'invocation-1', tool_name: 'generate_experience' })),
      markToolInvocationSucceeded: jest.fn(async () => undefined),
      findExperienceVersionByGenerationId: jest.fn(async () => null),
      createAssistantMessage: jest.fn(async () => ({ id: 'assistant-error-1' })),
      markRunSucceeded: jest.fn(async () => undefined),
      markToolInvocationFailed: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
    };

    const decisionRouter = {
      decideRoute: jest.fn(async () => ({
        tier: 'fast' as const,
        confidence: 0.84,
        reason: 'Simple request',
        fallbackReason: null,
        selectedProvider: 'openai' as const,
        selectedModel: 'gpt-5-mini',
      })),
    };

    const toolRegistry = {
      executeGenerateExperience: jest.fn(async () => {
        throw new AppError('PROVIDER_TIMEOUT', 'Provider timed out', 504);
      }),
    };

    const events = {
      latestEventId: jest.fn(() => null),
      publish: jest.fn(),
    };

    const service = new ChatRuntimeService(
      repository as never,
      decisionRouter as never,
      toolRegistry as never,
      events as never,
    );

    const result = await service.submitMessage({
      threadId: 'thread-1',
      request: {
        clientId: 'client-1',
        content: 'Build a quiz',
      },
    });

    expect(result.run?.status).toBe('failed');
    expect(repository.markToolInvocationFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        invocationId: 'invocation-1',
        errorCode: 'PROVIDER_TIMEOUT',
      }),
    );
    expect(repository.markRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        errorCode: 'PROVIDER_TIMEOUT',
      }),
    );
  });

  it('keeps idempotent submissions from rerouting when run already exists', async () => {
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
      recordRunRoutingDecision: jest.fn(async () => undefined),
      getRunById: jest.fn(async () => createRunRow({ id: 'run-existing', status: 'succeeded' })),
      markRunRunning: jest.fn(async () => undefined),
      updateSandboxState: jest.fn(async () => undefined),
      createToolInvocation: jest.fn(async () => ({ id: 'invocation-1', tool_name: 'generate_experience' })),
      markToolInvocationSucceeded: jest.fn(async () => undefined),
      findExperienceVersionByGenerationId: jest.fn(async () => null),
      createAssistantMessage: jest.fn(async () => ({ id: 'assistant-1' })),
      markRunSucceeded: jest.fn(async () => undefined),
      markToolInvocationFailed: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
    };

    const decisionRouter = {
      decideRoute: jest.fn(async () => ({
        tier: 'fast' as const,
        confidence: 0.84,
        reason: 'Simple request',
        fallbackReason: null,
        selectedProvider: 'openai' as const,
        selectedModel: 'gpt-5-mini',
      })),
    };

    const toolRegistry = {
      executeGenerateExperience: jest.fn(async () => ({ toolName: 'generate_experience' as const, payload: null })),
    };

    const events = {
      latestEventId: jest.fn(() => null),
      publish: jest.fn(),
    };

    const service = new ChatRuntimeService(
      repository as never,
      decisionRouter as never,
      toolRegistry as never,
      events as never,
    );

    const result = await service.submitMessage({
      threadId: 'thread-1',
      request: {
        clientId: 'client-1',
        content: 'Build a quiz',
      },
    });

    expect(result.deduplicated).toBe(true);
    expect(decisionRouter.decideRoute).not.toHaveBeenCalled();
  });
});
