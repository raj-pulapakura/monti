import { Injectable, Logger } from '@nestjs/common';
import { ValidationError } from '../../common/errors/app-error';
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
  ToolInvocationEnvelope,
} from '../runtime.types';
import { ChatRuntimeRepository } from './chat-runtime.repository';
import { ChatRuntimeEventService } from './chat-runtime-event.service';
import { ConversationLoopService } from './conversation-loop.service';

@Injectable()
export class ChatRuntimeService {
  private readonly logger = new Logger(ChatRuntimeService.name);

  constructor(
    private readonly repository: ChatRuntimeRepository,
    private readonly events: ChatRuntimeEventService,
    private readonly conversationLoop: ConversationLoopService,
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
      activeToolInvocation: result.activeToolInvocation
        ? mapToolInvocation(result.activeToolInvocation)
        : null,
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
    if (run && run.status === 'queued' && isConversationLoopEnabled()) {
      const executedRun = await this.conversationLoop.executeTurn({
        threadId: input.threadId,
        clientId: input.request.clientId,
        userMessage: result.message,
        run,
      });
      run = executedRun;
      this.logger.log(
        JSON.stringify({
          event: 'chat_runtime_conversation_turn_completed',
          runId: executedRun.id,
          terminalStatus: executedRun.status,
        }),
      );
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
  conversation_provider: 'openai' | 'anthropic' | 'gemini' | null;
  conversation_model: string | null;
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
    conversationModel: {
      provider: row.conversation_provider,
      model: row.conversation_model,
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

function mapToolInvocation(row: {
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
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}): ToolInvocationEnvelope {
  return {
    id: row.id,
    threadId: row.thread_id,
    runId: row.run_id,
    providerToolCallId: row.provider_tool_call_id,
    toolName: row.tool_name,
    toolArguments: row.tool_arguments,
    toolResult: row.tool_result,
    generationId: row.generation_id,
    experienceId: row.experience_id,
    experienceVersionId: row.experience_version_id,
    status: row.status,
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

function assertChatRuntimeEnabled(): void {
  const flag = process.env.CHAT_RUNTIME_ENABLED?.trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') {
    throw new ValidationError('Chat runtime is disabled by feature flag.');
  }
}

function isConversationLoopEnabled(): boolean {
  const flag = process.env.CONVERSATION_LOOP_ENABLED?.trim().toLowerCase();
  return !(flag === 'false' || flag === '0' || flag === 'off');
}
