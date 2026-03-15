import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from './../src/app.module';
import { AppError, ValidationError } from './../src/common/errors/app-error';
import { ChatRuntimeController } from './../src/chat-runtime/chat-runtime.controller';
import { ChatRuntimeRepository } from './../src/chat-runtime/services/chat-runtime.repository';
import { ChatToolRegistryService } from './../src/chat-runtime/tools/chat-tool-registry.service';
import { LlmDecisionRouterService } from './../src/llm/llm-decision-router.service';
import { ToolLlmRouterService } from './../src/llm/tool-runtime/tool-llm-router.service';

type ProviderKind = 'openai' | 'anthropic' | 'gemini';
type QualityTier = 'fast' | 'quality';

type ThreadRow = {
  id: string;
  client_id: string;
  title: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  client_id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  content_json: Record<string, unknown> | null;
  idempotency_key: string | null;
  created_at: string;
};

type RunRow = {
  id: string;
  thread_id: string;
  user_message_id: string;
  assistant_message_id: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  router_tier: QualityTier | null;
  router_provider_hint: ProviderKind | null;
  router_confidence: number | null;
  router_reason: string | null;
  router_fallback_reason: string | null;
  conversation_provider: ProviderKind | null;
  conversation_model: string | null;
  provider: ProviderKind | null;
  model: string | null;
  provider_request_raw: Record<string, unknown> | null;
  provider_response_raw: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type ToolInvocationRow = {
  id: string;
  thread_id: string;
  run_id: string;
  provider_tool_call_id: string | null;
  tool_name: string;
  tool_arguments: Record<string, unknown>;
  tool_result: Record<string, unknown> | null;
  generation_id: string | null;
  experience_id: string | null;
  experience_version_id: string | null;
  router_tier: QualityTier | null;
  router_confidence: number | null;
  router_reason: string | null;
  router_fallback_reason: string | null;
  selected_provider: ProviderKind | null;
  selected_model: string | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type SandboxStateRow = {
  thread_id: string;
  status: 'empty' | 'creating' | 'ready' | 'error';
  experience_id: string | null;
  experience_version_id: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  updated_at: string;
};

type ExperienceVersionRow = {
  id: string;
  experienceId: string;
  generationId: string;
  title: string;
  description: string;
  html: string;
  css: string;
  js: string;
};

class InMemoryChatRuntimeRepository {
  private readonly threads = new Map<string, ThreadRow>();
  private readonly messages: MessageRow[] = [];
  private readonly runs = new Map<string, RunRow>();
  private readonly toolInvocations = new Map<string, ToolInvocationRow>();
  private readonly sandboxStates = new Map<string, SandboxStateRow>();
  private readonly versionByGenerationId = new Map<string, ExperienceVersionRow>();
  private readonly idempotency = new Map<string, { messageId: string; runId: string }>();

  async createThread(input: {
    clientId: string;
    title?: string;
  }): Promise<{
    thread: ThreadRow;
    sandboxState: SandboxStateRow;
  }> {
    const now = new Date().toISOString();
    const thread: ThreadRow = {
      id: randomUUID(),
      client_id: input.clientId,
      title: input.title ?? null,
      archived_at: null,
      created_at: now,
      updated_at: now,
    };

    const sandboxState: SandboxStateRow = {
      thread_id: thread.id,
      status: 'empty',
      experience_id: null,
      experience_version_id: null,
      last_error_code: null,
      last_error_message: null,
      updated_at: now,
    };

    this.threads.set(thread.id, thread);
    this.sandboxStates.set(thread.id, sandboxState);

    return {
      thread,
      sandboxState,
    };
  }

  async hydrateThread(input: {
    threadId: string;
    clientId: string;
  }): Promise<{
    thread: ThreadRow;
    messages: MessageRow[];
    sandboxState: SandboxStateRow;
    activeRun: RunRow | null;
    activeToolInvocation: ToolInvocationRow | null;
  }> {
    const thread = this.findScopedThread(input.threadId, input.clientId);

    const messages = this.messages
      .filter((message) => message.thread_id === input.threadId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    const sandboxState = this.sandboxStates.get(input.threadId);
    if (!sandboxState) {
      throw new AppError('INTERNAL_ERROR', 'Sandbox state is missing for thread.', 500);
    }

    const activeRun = [...this.runs.values()]
      .filter((run) => run.thread_id === input.threadId && (run.status === 'queued' || run.status === 'running'))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

    const activeToolInvocation = [...this.toolInvocations.values()]
      .filter(
        (invocation) =>
          invocation.thread_id === input.threadId &&
          (invocation.status === 'pending' || invocation.status === 'running'),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

    return {
      thread,
      messages,
      sandboxState,
      activeRun,
      activeToolInvocation,
    };
  }

  async submitUserMessage(input: {
    threadId: string;
    clientId: string;
    content: string;
    idempotencyKey?: string;
  }): Promise<{
    message: MessageRow;
    run: RunRow | null;
    deduplicated: boolean;
  }> {
    this.findScopedThread(input.threadId, input.clientId);

    const dedupKey = input.idempotencyKey ? `${input.threadId}:${input.idempotencyKey}` : null;
    if (dedupKey) {
      const existing = this.idempotency.get(dedupKey);
      if (existing) {
        const message = this.messages.find((row) => row.id === existing.messageId);
        const run = this.runs.get(existing.runId) ?? null;

        if (!message) {
          throw new AppError('INTERNAL_ERROR', 'Submitted message was not found.', 500);
        }

        return {
          message,
          run,
          deduplicated: true,
        };
      }
    }

    const now = new Date().toISOString();
    const message: MessageRow = {
      id: randomUUID(),
      thread_id: input.threadId,
      client_id: input.clientId,
      role: 'user',
      content: input.content,
      content_json: null,
      idempotency_key: input.idempotencyKey ?? null,
      created_at: now,
    };

    const run: RunRow = {
      id: randomUUID(),
      thread_id: input.threadId,
      user_message_id: message.id,
      assistant_message_id: null,
      status: 'queued',
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
      created_at: now,
    };

    this.messages.push(message);
    this.runs.set(run.id, run);

    if (dedupKey) {
      this.idempotency.set(dedupKey, {
        messageId: message.id,
        runId: run.id,
      });
    }

    return {
      message,
      run,
      deduplicated: false,
    };
  }

  async recordRunProviderTrace(input: {
    runId: string;
    providerRequestRaw: Record<string, unknown>;
    providerResponseRaw: Record<string, unknown>;
  }): Promise<void> {
    const run = this.getRequiredRun(input.runId);
    run.provider_request_raw = input.providerRequestRaw;
    run.provider_response_raw = input.providerResponseRaw;
  }

  async recordRunRoutingDecision(input: {
    runId: string;
    tier: QualityTier;
    confidence: number;
    reason: string;
    fallbackReason: string | null;
    selectedProvider: ProviderKind;
    selectedModel: string;
  }): Promise<void> {
    const run = this.getRequiredRun(input.runId);
    run.router_tier = input.tier;
    run.router_provider_hint = null;
    run.router_confidence = input.confidence;
    run.router_reason = input.reason;
    run.router_fallback_reason = input.fallbackReason;
    run.provider = input.selectedProvider;
    run.model = input.selectedModel;
  }

  async getRunById(runId: string): Promise<RunRow | null> {
    return this.runs.get(runId) ?? null;
  }

  async getSandboxPreview(input: {
    threadId: string;
    clientId: string;
  }): Promise<{
    sandboxState: SandboxStateRow;
    activeExperience: {
      title: string;
      description: string;
      html: string;
      css: string;
      js: string;
      generationId: string;
    } | null;
  }> {
    this.findScopedThread(input.threadId, input.clientId);

    const sandboxState = this.sandboxStates.get(input.threadId);
    if (!sandboxState) {
      throw new AppError('INTERNAL_ERROR', 'Sandbox state is missing for thread.', 500);
    }

    if (!sandboxState.experience_version_id) {
      return {
        sandboxState,
        activeExperience: null,
      };
    }

    const version = [...this.versionByGenerationId.values()].find(
      (candidate) => candidate.id === sandboxState.experience_version_id,
    );

    if (!version) {
      return {
        sandboxState,
        activeExperience: null,
      };
    }

    return {
      sandboxState,
      activeExperience: {
        title: version.title,
        description: version.description,
        html: version.html,
        css: version.css,
        js: version.js,
        generationId: version.generationId,
      },
    };
  }

  async markRunRunning(
    runId: string,
    options?: {
      conversationProvider?: ProviderKind;
      conversationModel?: string;
    },
  ): Promise<void> {
    const run = this.getRequiredRun(runId);
    run.status = 'running';
    run.started_at = new Date().toISOString();
    run.conversation_provider = options?.conversationProvider ?? null;
    run.conversation_model = options?.conversationModel ?? null;
    run.error_code = null;
    run.error_message = null;
  }

  async markRunSucceeded(input: {
    runId: string;
    assistantMessageId: string;
  }): Promise<void> {
    const run = this.getRequiredRun(input.runId);
    run.status = 'succeeded';
    run.assistant_message_id = input.assistantMessageId;
    run.error_code = null;
    run.error_message = null;
    run.completed_at = new Date().toISOString();
  }

  async markRunFailed(input: {
    runId: string;
    errorCode: string;
    errorMessage: string;
    assistantMessageId?: string | null;
  }): Promise<void> {
    const run = this.getRequiredRun(input.runId);
    run.status = 'failed';
    run.assistant_message_id = input.assistantMessageId ?? null;
    run.error_code = input.errorCode;
    run.error_message = input.errorMessage;
    run.completed_at = new Date().toISOString();
  }

  async createAssistantMessage(input: {
    threadId: string;
    clientId: string;
    content: string;
    contentJson?: Record<string, unknown> | null;
  }): Promise<MessageRow> {
    const row: MessageRow = {
      id: randomUUID(),
      thread_id: input.threadId,
      client_id: input.clientId,
      role: 'assistant',
      content: input.content,
      content_json: input.contentJson ?? null,
      idempotency_key: null,
      created_at: new Date().toISOString(),
    };

    this.messages.push(row);
    return row;
  }

  async createToolInvocation(input: {
    threadId: string;
    runId: string;
    providerToolCallId?: string | null;
    toolName: string;
    toolArguments: Record<string, unknown>;
  }): Promise<ToolInvocationRow> {
    const invocation: ToolInvocationRow = {
      id: randomUUID(),
      thread_id: input.threadId,
      run_id: input.runId,
      provider_tool_call_id: input.providerToolCallId ?? null,
      tool_name: input.toolName,
      tool_arguments: input.toolArguments,
      tool_result: null,
      generation_id: null,
      experience_id: null,
      experience_version_id: null,
      router_tier: null,
      router_confidence: null,
      router_reason: null,
      router_fallback_reason: null,
      selected_provider: null,
      selected_model: null,
      status: 'running',
      error_code: null,
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      created_at: new Date().toISOString(),
    };

    this.toolInvocations.set(invocation.id, invocation);
    return invocation;
  }

  async markToolInvocationSucceeded(input: {
    invocationId: string;
    toolResult: Record<string, unknown>;
    generationId?: string | null;
    experienceId?: string | null;
    experienceVersionId?: string | null;
    routerTier?: QualityTier | null;
    routerConfidence?: number | null;
    routerReason?: string | null;
    routerFallbackReason?: string | null;
    selectedProvider?: ProviderKind | null;
    selectedModel?: string | null;
  }): Promise<void> {
    const invocation = this.getRequiredToolInvocation(input.invocationId);
    invocation.status = 'succeeded';
    invocation.tool_result = input.toolResult;
    invocation.generation_id = input.generationId ?? null;
    invocation.experience_id = input.experienceId ?? null;
    invocation.experience_version_id = input.experienceVersionId ?? null;
    invocation.router_tier = input.routerTier ?? null;
    invocation.router_confidence = input.routerConfidence ?? null;
    invocation.router_reason = input.routerReason ?? null;
    invocation.router_fallback_reason = input.routerFallbackReason ?? null;
    invocation.selected_provider = input.selectedProvider ?? null;
    invocation.selected_model = input.selectedModel ?? null;
    invocation.error_code = null;
    invocation.error_message = null;
    invocation.completed_at = new Date().toISOString();

    const generationId = input.generationId ?? null;

    if (!generationId) {
      return;
    }

    if (!this.versionByGenerationId.has(generationId)) {
      const experienceId = randomUUID();
      const versionId = randomUUID();
      const title =
        typeof input.toolResult.title === 'string' && input.toolResult.title.trim().length > 0
          ? input.toolResult.title
          : 'Generated Experience';

      this.versionByGenerationId.set(generationId, {
        id: versionId,
        experienceId,
        generationId,
        title,
        description: 'Generated through chat runtime e2e flow.',
        html: `<main><h1>${title}</h1><p>Sandbox preview</p></main>`,
        css: 'main{padding:16px;font-family:sans-serif;}',
        js: 'console.log("chat-runtime-e2e");',
      });
    }
  }

  async markToolInvocationFailed(input: {
    invocationId: string;
    errorCode: string;
    errorMessage: string;
    toolResult?: Record<string, unknown> | null;
    routerTier?: QualityTier | null;
    routerConfidence?: number | null;
    routerReason?: string | null;
    routerFallbackReason?: string | null;
    selectedProvider?: ProviderKind | null;
    selectedModel?: string | null;
  }): Promise<void> {
    const invocation = this.getRequiredToolInvocation(input.invocationId);
    invocation.status = 'failed';
    invocation.tool_result = input.toolResult ?? null;
    invocation.router_tier = input.routerTier ?? null;
    invocation.router_confidence = input.routerConfidence ?? null;
    invocation.router_reason = input.routerReason ?? null;
    invocation.router_fallback_reason = input.routerFallbackReason ?? null;
    invocation.selected_provider = input.selectedProvider ?? null;
    invocation.selected_model = input.selectedModel ?? null;
    invocation.error_code = input.errorCode;
    invocation.error_message = input.errorMessage;
    invocation.completed_at = new Date().toISOString();
  }

  async findExperienceVersionByGenerationId(
    generationId: string,
  ): Promise<{ experienceId: string; versionId: string } | null> {
    const version = this.versionByGenerationId.get(generationId);
    if (!version) {
      return null;
    }

    return {
      experienceId: version.experienceId,
      versionId: version.id,
    };
  }

  async updateSandboxState(input: {
    threadId: string;
    status: 'empty' | 'creating' | 'ready' | 'error';
    experienceId?: string | null;
    experienceVersionId?: string | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  }): Promise<void> {
    const state = this.sandboxStates.get(input.threadId);
    if (!state) {
      throw new AppError('INTERNAL_ERROR', 'Sandbox state is missing for thread.', 500);
    }

    state.status = input.status;
    state.experience_id =
      input.experienceId === undefined ? state.experience_id : input.experienceId;
    state.experience_version_id =
      input.experienceVersionId === undefined
        ? state.experience_version_id
        : input.experienceVersionId;
    state.last_error_code =
      input.lastErrorCode === undefined ? state.last_error_code : input.lastErrorCode;
    state.last_error_message =
      input.lastErrorMessage === undefined ? state.last_error_message : input.lastErrorMessage;
    state.updated_at = new Date().toISOString();
  }

  getToolInvocationsByRun(runId: string): ToolInvocationRow[] {
    return [...this.toolInvocations.values()].filter((row) => row.run_id === runId);
  }

  private findScopedThread(threadId: string, clientId: string): ThreadRow {
    const thread = this.threads.get(threadId);

    if (!thread || thread.client_id !== clientId) {
      throw new ValidationError('Thread not found for client scope.');
    }

    return thread;
  }

  private getRequiredRun(runId: string): RunRow {
    const run = this.runs.get(runId);
    if (!run) {
      throw new AppError('INTERNAL_ERROR', `Run ${runId} not found.`, 500);
    }

    return run;
  }

  private getRequiredToolInvocation(invocationId: string): ToolInvocationRow {
    const invocation = this.toolInvocations.get(invocationId);
    if (!invocation) {
      throw new AppError('INTERNAL_ERROR', `Tool invocation ${invocationId} not found.`, 500);
    }

    return invocation;
  }
}

function createMockToolPayload(input: {
  generationId: string;
  provider: ProviderKind;
  model: string;
}) {
  return {
    experience: {
      title: 'Solar System Quiz',
      description: 'Learn planets through interactive questions.',
      html: '<main><h1>Solar System Quiz</h1><p>Question set</p></main>',
      css: 'main{font-family:sans-serif;padding:12px;}',
      js: 'console.log("solar-system-quiz");',
    },
    metadata: {
      generationId: input.generationId,
      provider: input.provider,
      model: input.model,
      qualityMode: 'fast' as const,
      maxTokens: 8192,
      renderingContract: {
        iframeOnly: true,
        sandbox: 'allow-scripts',
        networkAccess: 'disallowed',
        externalLibraries: 'disallowed',
      },
    },
  };
}

describe('Chat Runtime (e2e)', () => {
  let app: INestApplication;
  let chatRuntimeController: ChatRuntimeController;
  let repository: InMemoryChatRuntimeRepository;

  let routeDecision: {
    tier: QualityTier;
    confidence: number;
    reason: string;
    fallbackReason: string | null;
    selectedProvider: ProviderKind;
    selectedModel: string;
  };

  let forceToolFailure = false;

  const routerMock = {
    decideRoute: jest.fn(async () => routeDecision),
  };

  const conversationLlmMock = {
    runTurn: jest.fn(
      async (input: {
        messages: Array<{
          role: 'system' | 'user' | 'assistant' | 'tool';
          content: string;
          toolName?: string;
          toolCallId?: string;
        }>;
      }) => {
        const latestToolMessage = [...input.messages]
          .reverse()
          .find((message) => message.role === 'tool');

        if (!latestToolMessage) {
          return {
            provider: 'openai' as const,
            model: 'gpt-5.4',
            assistantText: 'Sure, building that for you now.',
            toolCalls: [
              {
                id: `call_${randomUUID()}`,
                name: 'generate_experience',
                arguments: {
                  operation: 'generate',
                  prompt: 'Build a learning experience for the latest user request.',
                },
              },
            ],
            finishReason: 'tool_calls' as const,
            rawRequest: { mocked: true },
            rawResponse: { mocked: true },
          };
        }

        const parsedToolResult = JSON.parse(latestToolMessage.content) as {
          status?: string;
          errorMessage?: string | null;
        };

        if (parsedToolResult.status === 'failed') {
          return {
            provider: 'openai' as const,
            model: 'gpt-5.4',
            assistantText:
              parsedToolResult.errorMessage ??
              'I could not generate that experience. Please try again.',
            toolCalls: [],
            finishReason: 'stop' as const,
            rawRequest: { mocked: true },
            rawResponse: { mocked: true },
          };
        }

        return {
          provider: 'openai' as const,
          model: 'gpt-5.4',
          assistantText: 'Experience generated. Tell me what you want to refine next.',
          toolCalls: [],
          finishReason: 'stop' as const,
          rawRequest: { mocked: true },
          rawResponse: { mocked: true },
        };
      },
    ),
  };

  const toolRegistryMock = {
    getToolDefinitions: jest.fn(() => [
      {
        name: 'generate_experience',
        description: 'Mock generation tool',
        inputSchema: {
          type: 'object',
          properties: {
            operation: { type: 'string' },
            prompt: { type: 'string' },
          },
        },
      },
    ]),
    hasTool: jest.fn((name: string) => name === 'generate_experience'),
    executeToolCall: jest.fn(
      async (input: {
        runId: string;
        toolCallId: string;
        arguments: Record<string, unknown>;
      }) => {
        const prompt =
          typeof input.arguments.prompt === 'string' ? input.arguments.prompt : '';
        const route = await routerMock.decideRoute({
          requestId: input.runId,
          prompt,
        });

        await repository.recordRunRoutingDecision({
          runId: input.runId,
          tier: route.tier,
          confidence: route.confidence,
          reason: route.reason,
          fallbackReason: route.fallbackReason,
          selectedProvider: route.selectedProvider,
          selectedModel: route.selectedModel,
        });

        if (forceToolFailure) {
          return {
            toolName: 'generate_experience',
            toolCallId: input.toolCallId,
            result: {
              status: 'failed' as const,
              generationId: null,
              experienceId: null,
              experienceVersionId: null,
              errorCode: 'PROVIDER_TIMEOUT',
              errorMessage: 'Provider timed out',
              sandboxStatus: 'error' as const,
              route,
            },
          };
        }

        const generationId = randomUUID();
        return {
          toolName: 'generate_experience',
          toolCallId: input.toolCallId,
          result: {
            status: 'succeeded' as const,
            generationId,
            experienceId: null,
            experienceVersionId: null,
            errorCode: null,
            errorMessage: null,
            sandboxStatus: 'ready' as const,
            route,
          },
        };
      },
    ),
  };

  beforeEach(async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.CHAT_RUNTIME_ENABLED = 'true';
    process.env.CONVERSATION_LOOP_ENABLED = 'true';
    process.env.ROUTER_STAGE_ENABLED = 'true';

    routeDecision = {
      tier: 'fast',
      confidence: 0.89,
      reason: 'Simple request fits fast tier.',
      fallbackReason: null,
      selectedProvider: 'openai',
      selectedModel: 'gpt-5-mini',
    };

    forceToolFailure = false;
    routerMock.decideRoute.mockClear();
    conversationLlmMock.runTurn.mockClear();
    toolRegistryMock.getToolDefinitions.mockClear();
    toolRegistryMock.hasTool.mockClear();
    toolRegistryMock.executeToolCall.mockClear();

    repository = new InMemoryChatRuntimeRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ChatRuntimeRepository)
      .useValue(repository)
      .overrideProvider(LlmDecisionRouterService)
      .useValue(routerMock)
      .overrideProvider(ChatToolRegistryService)
      .useValue(toolRegistryMock)
      .overrideProvider(ToolLlmRouterService)
      .useValue(conversationLlmMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    chatRuntimeController = moduleFixture.get<ChatRuntimeController>(ChatRuntimeController);
  });

  afterEach(async () => {
    await app.close();
    delete process.env.CHAT_RUNTIME_ENABLED;
    delete process.env.CONVERSATION_LOOP_ENABLED;
    delete process.env.ROUTER_STAGE_ENABLED;
  });

  it('runs thread submit -> route -> tool execution -> sandbox update -> assistant reply', async () => {
    const clientId = 'client-success';

    const threadResponse = await chatRuntimeController.createThread({ clientId });
    const threadId = threadResponse.data.thread.id;

    const submitResponse = await chatRuntimeController.submitMessage(threadId, {
      clientId,
      content: 'Build a quick solar system quiz.',
      idempotencyKey: randomUUID(),
    });

    expect(submitResponse.data.deduplicated).toBe(false);
    expect(submitResponse.data.run?.status).toBe('succeeded');
    expect(routerMock.decideRoute).toHaveBeenCalledTimes(1);
    expect(toolRegistryMock.executeToolCall).toHaveBeenCalledTimes(1);
    expect(conversationLlmMock.runTurn).toHaveBeenCalledTimes(2);

    const runId = submitResponse.data.run?.id;
    expect(runId).toBeTruthy();

    const invocations = repository.getToolInvocationsByRun(runId as string);
    expect(invocations).toHaveLength(1);
    expect(invocations[0].status).toBe('succeeded');
    expect(invocations[0].generation_id).toBeTruthy();
    expect(invocations[0].router_tier).toBe('fast');
    expect(invocations[0].selected_provider).toBe('openai');
    expect(invocations[0].selected_model).toBe('gpt-5-mini');

    const hydrationResponse = await chatRuntimeController.hydrateThread(threadId, { clientId });
    expect(hydrationResponse.data.messages).toHaveLength(3);
    expect(hydrationResponse.data.messages[0].role).toBe('user');
    expect(hydrationResponse.data.messages[1].role).toBe('assistant');
    expect(hydrationResponse.data.messages[2].role).toBe('assistant');
    expect(hydrationResponse.data.sandboxState.status).toBe('ready');
    expect(hydrationResponse.data.latestEventId).toBeTruthy();

    const sandboxResponse = await chatRuntimeController.getSandboxPreview(threadId, { clientId });
    expect(sandboxResponse.data.sandboxState.status).toBe('ready');
    expect(sandboxResponse.data.activeExperience).toBeTruthy();
    expect(sandboxResponse.data.activeExperience?.generationId).toBeTruthy();
  });

  it('persists fallback routing metadata and normalizes provider tool failures', async () => {
    const clientId = 'client-failure';

    const threadResponse = await chatRuntimeController.createThread({ clientId });
    const threadId = threadResponse.data.thread.id;

    routeDecision = {
      tier: 'fast',
      confidence: 0,
      reason: 'Fallback routing policy applied.',
      fallbackReason: 'Router response missing valid tier.',
      selectedProvider: 'gemini',
      selectedModel: 'gemini-3.1-flash-lite-preview',
    };
    forceToolFailure = true;

    const submitResponse = await chatRuntimeController.submitMessage(threadId, {
      clientId,
      content: 'Build an adaptive quiz for me.',
      idempotencyKey: randomUUID(),
    });

    expect(submitResponse.data.run?.status).toBe('succeeded');
    expect(submitResponse.data.run?.routerDecision.fallbackReason).toBe(
      'Router response missing valid tier.',
    );
    expect(submitResponse.data.run?.error.code).toBeNull();

    const runId = submitResponse.data.run?.id;
    expect(runId).toBeTruthy();

    const invocations = repository.getToolInvocationsByRun(runId as string);
    expect(invocations).toHaveLength(1);
    expect(invocations[0].status).toBe('failed');
    expect(invocations[0].error_code).toBe('PROVIDER_TIMEOUT');
    expect(invocations[0].router_fallback_reason).toBe('Router response missing valid tier.');
    expect(invocations[0].selected_provider).toBe('gemini');

    const hydrationResponse = await chatRuntimeController.hydrateThread(threadId, { clientId });
    expect(hydrationResponse.data.sandboxState.status).toBe('error');
    expect(hydrationResponse.data.sandboxState.lastErrorCode).toBe('PROVIDER_TIMEOUT');
    expect(hydrationResponse.data.messages).toHaveLength(3);
    expect(hydrationResponse.data.messages[2].role).toBe('assistant');
    expect(hydrationResponse.data.messages[2].content).toContain('Provider timed out');
  });

  it('enforces idempotent submit semantics and keeps hydration stable for reconnect', async () => {
    const clientId = 'client-idempotent';

    const threadResponse = await chatRuntimeController.createThread({ clientId });
    const threadId = threadResponse.data.thread.id;
    const idempotencyKey = randomUUID();

    const firstSubmit = await chatRuntimeController.submitMessage(threadId, {
      clientId,
      content: 'Create a fractions practice game.',
      idempotencyKey,
    });

    const secondSubmit = await chatRuntimeController.submitMessage(threadId, {
      clientId,
      content: 'Create a fractions practice game.',
      idempotencyKey,
    });

    expect(firstSubmit.data.deduplicated).toBe(false);
    expect(secondSubmit.data.deduplicated).toBe(true);
    expect(secondSubmit.data.message.id).toBe(firstSubmit.data.message.id);
    expect(secondSubmit.data.run?.id).toBe(firstSubmit.data.run?.id);
    expect(routerMock.decideRoute).toHaveBeenCalledTimes(1);

    const firstHydration = await chatRuntimeController.hydrateThread(threadId, { clientId });
    const secondHydration = await chatRuntimeController.hydrateThread(threadId, { clientId });

    expect(firstHydration.data.messages).toHaveLength(3);
    expect(secondHydration.data.messages).toHaveLength(3);
    expect(secondHydration.data.messages[0].id).toBe(firstHydration.data.messages[0].id);
    expect(secondHydration.data.messages[1].id).toBe(firstHydration.data.messages[1].id);
    expect(secondHydration.data.messages[2].id).toBe(firstHydration.data.messages[2].id);
    expect(firstHydration.data.latestEventId).toBeTruthy();
    expect(secondHydration.data.latestEventId).toBe(firstHydration.data.latestEventId);
    expect(secondHydration.data.sandboxState.status).toBe('ready');
  });
});
