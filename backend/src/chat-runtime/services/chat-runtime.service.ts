import { Injectable, Logger } from '@nestjs/common';
import { AppError, ValidationError } from '../../common/errors/app-error';
import { LlmDecisionRouterService } from '../../llm/llm-decision-router.service';
import type {
  CreateThreadRequest,
  HydrateThreadRequest,
  SubmitMessagePayload,
  SubmitMessageRequest,
  ThreadEnvelope,
  ThreadHydrationPayload,
} from '../dto/chat-runtime.dto';
import type {
  AssistantRunEnvelope,
  ChatMessageEnvelope,
  SandboxStateEnvelope,
} from '../runtime.types';
import { ChatRuntimeRepository } from './chat-runtime.repository';
import { ChatRuntimeEventService } from './chat-runtime-event.service';
import { ChatToolRegistryService } from '../tools/chat-tool-registry.service';

@Injectable()
export class ChatRuntimeService {
  private readonly logger = new Logger(ChatRuntimeService.name);

  constructor(
    private readonly repository: ChatRuntimeRepository,
    private readonly decisionRouter: LlmDecisionRouterService,
    private readonly toolRegistry: ChatToolRegistryService,
    private readonly events: ChatRuntimeEventService,
  ) {}

  async createThread(request: CreateThreadRequest): Promise<{
    thread: ThreadEnvelope;
    sandboxState: SandboxStateEnvelope;
  }> {
    assertChatRuntimeEnabled();
    const result = await this.repository.createThread(request);

    return {
      thread: mapThread(result.thread),
      sandboxState: mapSandboxState(result.sandboxState),
    };
  }

  async hydrateThread(request: HydrateThreadRequest): Promise<ThreadHydrationPayload> {
    assertChatRuntimeEnabled();
    const result = await this.repository.hydrateThread(request);

    return {
      thread: mapThread(result.thread),
      messages: result.messages.map(mapMessage),
      sandboxState: mapSandboxState(result.sandboxState),
      activeRun: result.activeRun ? mapRun(result.activeRun) : null,
      latestEventId: this.events.latestEventId(request.threadId),
    };
  }

  async getSandboxPreview(input: {
    threadId: string;
    clientId: string;
  }): Promise<{
    sandboxState: SandboxStateEnvelope;
    activeExperience: {
      title: string;
      description: string;
      html: string;
      css: string;
      js: string;
      generationId: string;
    } | null;
  }> {
    assertChatRuntimeEnabled();
    const result = await this.repository.getSandboxPreview(input);

    return {
      sandboxState: mapSandboxState(result.sandboxState),
      activeExperience: result.activeExperience,
    };
  }

  async submitMessage(input: {
    threadId: string;
    request: SubmitMessageRequest;
  }): Promise<SubmitMessagePayload> {
    assertChatRuntimeEnabled();
    const result = await this.repository.submitUserMessage({
      threadId: input.threadId,
      clientId: input.request.clientId,
      content: input.request.content,
      idempotencyKey: input.request.idempotencyKey,
    });

    let run = result.run;
    if (run && run.router_tier === null) {
      const routing = await this.decisionRouter.decideRoute({
        requestId: run.id,
        prompt: result.message.content,
      });

      await this.repository.recordRunRoutingDecision({
        runId: run.id,
        tier: routing.tier,
        confidence: routing.confidence,
        reason: routing.reason,
        fallbackReason: routing.fallbackReason,
        selectedProvider: routing.selectedProvider,
        selectedModel: routing.selectedModel,
      });

      const refreshedRun = await this.repository.getRunById(run.id);
      if (refreshedRun) {
        run = refreshedRun;
      }

      this.logger.log(
        JSON.stringify({
          event: 'chat_runtime_route_selected',
          runId: run.id,
          tier: routing.tier,
          selectedProvider: routing.selectedProvider,
          selectedModel: routing.selectedModel,
          confidence: routing.confidence,
          fallbackReason: routing.fallbackReason,
        }),
      );
    }

    if (run && run.status === 'queued' && run.router_tier && run.provider && isNativeToolLoopEnabled()) {
      const runStartedAt = Date.now();
      await this.repository.markRunRunning(run.id);
      this.events.publish({
        threadId: input.threadId,
        runId: run.id,
        type: 'run_started',
        payload: {
          runId: run.id,
          provider: run.provider,
          tier: run.router_tier,
        },
      });
      await this.repository.updateSandboxState({
        threadId: input.threadId,
        status: 'creating',
      });
      this.events.publish({
        threadId: input.threadId,
        runId: run.id,
        type: 'sandbox_updated',
        payload: {
          status: 'creating',
        },
      });

      const invocation = await this.repository.createToolInvocation({
        threadId: input.threadId,
        runId: run.id,
        providerToolCallId: `${run.provider}:${run.id}:generate_experience`,
        toolName: 'generate_experience',
        toolArguments: {
          operation: 'generate',
          prompt: result.message.content,
          tier: run.router_tier,
          provider: run.provider,
        },
      });
      this.events.publish({
        threadId: input.threadId,
        runId: run.id,
        type: 'tool_started',
        payload: {
          invocationId: invocation.id,
          toolName: invocation.tool_name,
        },
      });

      try {
        const toolStartedAt = Date.now();
        const execution = await this.toolRegistry.executeGenerateExperience({
          operation: 'generate',
          clientId: input.request.clientId,
          prompt: result.message.content,
          qualityMode: run.router_tier,
          provider: run.provider,
        });

        await this.repository.markToolInvocationSucceeded({
          invocationId: invocation.id,
          toolResult: {
            generationId: execution.payload.metadata.generationId,
            provider: execution.payload.metadata.provider,
            model: execution.payload.metadata.model,
            title: execution.payload.experience.title,
          },
        });
        this.events.publish({
          threadId: input.threadId,
          runId: run.id,
          type: 'tool_succeeded',
          payload: {
            invocationId: invocation.id,
            generationId: execution.payload.metadata.generationId,
          },
        });

        const versionRef = await this.repository.findExperienceVersionByGenerationId(
          execution.payload.metadata.generationId,
        );

        await this.repository.updateSandboxState({
          threadId: input.threadId,
          status: 'ready',
          experienceId: versionRef?.experienceId ?? null,
          experienceVersionId: versionRef?.versionId ?? null,
          lastErrorCode: null,
          lastErrorMessage: null,
        });
        this.events.publish({
          threadId: input.threadId,
          runId: run.id,
          type: 'sandbox_updated',
          payload: {
            status: 'ready',
            experienceId: versionRef?.experienceId ?? null,
            experienceVersionId: versionRef?.versionId ?? null,
          },
        });

        const assistantMessage = await this.repository.createAssistantMessage({
          threadId: input.threadId,
          clientId: input.request.clientId,
          content:
            'Experience created. Open the sandbox preview and reply with refinement instructions when ready.',
          contentJson: {
            tool: execution.toolName,
            generationId: execution.payload.metadata.generationId,
            provider: execution.payload.metadata.provider,
            model: execution.payload.metadata.model,
          },
        });
        this.events.publish({
          threadId: input.threadId,
          runId: run.id,
          type: 'assistant_message_created',
          payload: {
            messageId: assistantMessage.id,
          },
        });

        await this.repository.markRunSucceeded({
          runId: run.id,
          assistantMessageId: assistantMessage.id,
        });
        this.logger.log(
          JSON.stringify({
            event: 'chat_runtime_tool_succeeded',
            runId: run.id,
            toolName: execution.toolName,
            generationId: execution.payload.metadata.generationId,
            provider: execution.payload.metadata.provider,
            model: execution.payload.metadata.model,
            durationMs: Date.now() - toolStartedAt,
            runDurationMs: Date.now() - runStartedAt,
            terminalStatus: 'succeeded',
          }),
        );
        this.events.publish({
          threadId: input.threadId,
          runId: run.id,
          type: 'run_completed',
          payload: {
            runId: run.id,
          },
        });
      } catch (error) {
        const errorCode = toErrorCode(error);
        const errorMessage = toErrorMessage(error);

        await this.repository.markToolInvocationFailed({
          invocationId: invocation.id,
          errorCode,
          errorMessage,
        });
        this.events.publish({
          threadId: input.threadId,
          runId: run.id,
          type: 'tool_failed',
          payload: {
            invocationId: invocation.id,
            errorCode,
            errorMessage,
          },
        });

        await this.repository.updateSandboxState({
          threadId: input.threadId,
          status: 'error',
          lastErrorCode: errorCode,
          lastErrorMessage: errorMessage,
        });
        this.events.publish({
          threadId: input.threadId,
          runId: run.id,
          type: 'sandbox_updated',
          payload: {
            status: 'error',
            errorCode,
            errorMessage,
          },
        });

        const assistantErrorMessage = await this.repository.createAssistantMessage({
          threadId: input.threadId,
          clientId: input.request.clientId,
          content:
            'I could not create the experience for this request. Please revise the prompt and try again.',
          contentJson: {
            errorCode,
            errorMessage,
            tool: 'generate_experience',
          },
        });
        this.events.publish({
          threadId: input.threadId,
          runId: run.id,
          type: 'assistant_message_created',
          payload: {
            messageId: assistantErrorMessage.id,
          },
        });

        await this.repository.markRunFailed({
          runId: run.id,
          errorCode,
          errorMessage,
          assistantMessageId: assistantErrorMessage.id,
        });
        this.logger.error(
          JSON.stringify({
            event: 'chat_runtime_tool_failed',
            runId: run.id,
            invocationId: invocation.id,
            errorCode,
            errorMessage,
            runDurationMs: Date.now() - runStartedAt,
            terminalStatus: 'failed',
          }),
        );
        this.events.publish({
          threadId: input.threadId,
          runId: run.id,
          type: 'run_failed',
          payload: {
            runId: run.id,
            errorCode,
            errorMessage,
          },
        });
      }

      const refreshedRun = await this.repository.getRunById(run.id);
      if (refreshedRun) {
        run = refreshedRun;
      }
    }

    return {
      threadId: input.threadId,
      message: mapMessage(result.message),
      run: run ? mapRun(run) : null,
      deduplicated: result.deduplicated,
    };
  }

  async recordRunProviderTrace(input: {
    runId: string;
    providerRequestRaw: Record<string, unknown>;
    providerResponseRaw: Record<string, unknown>;
  }): Promise<void> {
    await this.repository.recordRunProviderTrace(input);
  }
}

function mapThread(row: {
  id: string;
  client_id: string;
  title: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}): ThreadEnvelope {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: {
  id: string;
  thread_id: string;
  client_id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  content_json: Record<string, unknown> | null;
  idempotency_key: string | null;
  created_at: string;
}): ChatMessageEnvelope {
  return {
    id: row.id,
    threadId: row.thread_id,
    clientId: row.client_id,
    role: row.role,
    content: row.content,
    contentJson: row.content_json,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}

function mapRun(row: {
  id: string;
  thread_id: string;
  user_message_id: string;
  assistant_message_id: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  router_tier: 'fast' | 'quality' | null;
  router_provider_hint: 'openai' | 'anthropic' | 'gemini' | null;
  router_confidence: number | null;
  router_reason: string | null;
  router_fallback_reason: string | null;
  provider: 'openai' | 'anthropic' | 'gemini' | null;
  model: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}): AssistantRunEnvelope {
  return {
    id: row.id,
    threadId: row.thread_id,
    userMessageId: row.user_message_id,
    assistantMessageId: row.assistant_message_id,
    status: row.status,
    routerDecision: {
      tier: row.router_tier,
      confidence: row.router_confidence,
      reason: row.router_reason,
      fallbackReason: row.router_fallback_reason,
    },
    selectedProvider: row.provider,
    selectedModel: row.model,
    error: {
      code: row.error_code,
      message: row.error_message,
    },
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function mapSandboxState(row: {
  thread_id: string;
  status: 'empty' | 'creating' | 'ready' | 'error';
  experience_id: string | null;
  experience_version_id: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  updated_at: string;
}): SandboxStateEnvelope {
  return {
    threadId: row.thread_id,
    status: row.status,
    experienceId: row.experience_id,
    experienceVersionId: row.experience_version_id,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    updatedAt: row.updated_at,
  };
}

function toErrorCode(error: unknown): string {
  if (error instanceof AppError) {
    return error.code;
  }

  if (error instanceof Error) {
    return error.name || 'ERROR';
  }

  return 'UNKNOWN_ERROR';
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'An unexpected error occurred during tool execution.';
}

function assertChatRuntimeEnabled(): void {
  const flag = process.env.CHAT_RUNTIME_ENABLED?.trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') {
    throw new ValidationError('Chat runtime is disabled by feature flag.');
  }
}

function isNativeToolLoopEnabled(): boolean {
  const flag = process.env.NATIVE_TOOL_LOOP_ENABLED?.trim().toLowerCase();
  return !(flag === 'false' || flag === '0' || flag === 'off');
}
