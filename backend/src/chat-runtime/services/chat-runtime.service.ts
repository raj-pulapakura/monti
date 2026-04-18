import { Injectable, Logger } from '@nestjs/common';
import { BillingConfigService } from '../../billing/billing-config.service';
import { BillingRepository } from '../../billing/billing.repository';
import { resolvePricingFromSnapshot } from '../../billing/billing-pricing';
import { EntitlementService } from '../../billing/entitlement.service';
import { InsufficientCreditsError, ValidationError } from '../../common/errors/app-error';
import type {
  CreateThreadRequest,
  HydrateThreadRequest,
  ListThreadsRequest,
  ThreadListItemEnvelope,
  ThreadListPayload,
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
import type { ToolConfirmationMetadata } from '../tools/chat-tool.interface';

@Injectable()
export class ChatRuntimeService {
  private readonly logger = new Logger(ChatRuntimeService.name);

  constructor(
    private readonly repository: ChatRuntimeRepository,
    private readonly events: ChatRuntimeEventService,
    private readonly conversationLoop: ConversationLoopService,
    private readonly entitlements: EntitlementService,
    private readonly billingConfig: BillingConfigService,
    private readonly billingRepository: BillingRepository,
  ) {}

  async listThreads(input: {
    request: ListThreadsRequest;
    userId: string;
  }): Promise<ThreadListPayload> {
    assertChatRuntimeEnabled();
    const threads = await this.repository.listThreads({
      userId: input.userId,
      limit: input.request.limit,
    });

    return {
      threads: threads.map(mapThreadListItem),
    };
  }

  async createThread(input: {
    request: CreateThreadRequest;
    userId: string;
  }): Promise<{
    thread: ThreadEnvelope;
    sandboxState: SandboxStateEnvelope;
  }> {
    assertChatRuntimeEnabled();
    const result = await this.repository.createThread({
      title: input.request.title,
      userId: input.userId,
    });

    return {
      thread: mapThread(result.thread),
      sandboxState: mapSandboxState(result.sandboxState),
    };
  }

  async hydrateThread(input: {
    request: HydrateThreadRequest;
    userId: string;
  }): Promise<ThreadHydrationPayload> {
    assertChatRuntimeEnabled();
    const result = await this.repository.hydrateThread({
      threadId: input.request.threadId,
      userId: input.userId,
    });

    return {
      thread: mapThread(result.thread),
      messages: result.messages.map(mapMessage),
      sandboxState: mapSandboxState(result.sandboxState),
      activeRun: result.activeRun ? mapRun(result.activeRun) : null,
      activeToolInvocation: result.activeToolInvocation
        ? mapToolInvocation(result.activeToolInvocation)
        : null,
      latestEventId: this.events.latestHydrationCursor(input.request.threadId),
    };
  }

  async getSandboxPreview(input: {
    threadId: string;
    userId: string;
  }): Promise<{
    sandboxState: SandboxStateEnvelope;
    activeExperience: {
      title: string;
      description: string;
      html: string;
      css: string;
      js: string;
      generationId: string;
      slug: string | null;
      isFavourite: boolean;
    } | null;
    allVersions: { id: string; versionNumber: number; promptSummary: string }[];
  }> {
    assertChatRuntimeEnabled();
    const result = await this.repository.getSandboxPreview(input);

    return {
      sandboxState: mapSandboxState(result.sandboxState),
      activeExperience: result.activeExperience,
      allVersions: result.allVersions,
    };
  }

  async getVersionContent(input: {
    threadId: string;
    userId: string;
    versionId: string;
  }): Promise<{ html: string; css: string; js: string }> {
    assertChatRuntimeEnabled();
    return this.repository.getVersionContent(input);
  }

  async assertThreadAccess(input: {
    threadId: string;
    userId: string;
  }): Promise<void> {
    assertChatRuntimeEnabled();
    await this.repository.assertThreadAccess(input);
  }

  async updateExperienceTitle(input: {
    threadId: string;
    userId: string;
    title: string;
  }): Promise<{ title: string }> {
    assertChatRuntimeEnabled();
    return this.repository.updateExperienceTitle(input);
  }

  async toggleExperienceFavourite(input: {
    threadId: string;
    userId: string;
    isFavourite: boolean;
  }): Promise<{ isFavourite: boolean }> {
    assertChatRuntimeEnabled();
    return this.repository.toggleFavourite(input);
  }

  async deleteThread(input: { threadId: string; userId: string }): Promise<void> {
    assertChatRuntimeEnabled();
    await this.repository.archiveThread(input);
  }

  async confirmRun(input: {
    threadId: string;
    runId: string;
    userId: string;
    decision: 'confirmed' | 'cancelled';
    qualityMode?: 'fast' | 'quality';
  }): Promise<void> {
    assertChatRuntimeEnabled();
    const run = await this.repository.getRunById(input.runId);
    if (!run || run.thread_id !== input.threadId) {
      throw new ValidationError('Run not found for this thread.');
    }
    if (run.status !== 'awaiting_confirmation') {
      throw new ValidationError('Run is not awaiting confirmation.');
    }

    const confirmedToolCallId = run.confirmation_tool_call_id;
    if (!confirmedToolCallId) {
      throw new ValidationError('Run has no pending tool confirmation.');
    }

    await this.repository.assertThreadAccess({
      threadId: input.threadId,
      userId: input.userId,
    });

    const userMessage = await this.repository.findChatMessageById(run.user_message_id);
    if (!userMessage) {
      throw new ValidationError('User message for this run was not found.');
    }

    void this.resumeConversationTurn({
      threadId: input.threadId,
      userId: input.userId,
      runId: input.runId,
      confirmedToolCallId,
      decision: input.decision,
      qualityMode: input.qualityMode,
      userMessage,
    });
  }

  private async resumeConversationTurn(input: {
    threadId: string;
    userId: string;
    runId: string;
    confirmedToolCallId: string;
    decision: 'confirmed' | 'cancelled';
    qualityMode?: 'fast' | 'quality';
    userMessage: {
      id: string;
      thread_id: string;
      user_id: string;
      role: 'user' | 'assistant' | 'tool' | 'system';
      content: string;
      content_json: Record<string, unknown> | null;
      idempotency_key: string | null;
      created_at: string;
    };
  }): Promise<void> {
    try {
      const executedRun = await this.conversationLoop.resumeTurn({
        threadId: input.threadId,
        userId: input.userId,
        runId: input.runId,
        confirmedToolCallId: input.confirmedToolCallId,
        decision: input.decision,
        qualityMode: input.qualityMode,
        userMessage: input.userMessage,
      });
      this.logger.log(
        JSON.stringify({
          event: 'chat_runtime_conversation_resume_completed',
          runId: executedRun.id,
          terminalStatus: executedRun.status,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'chat_runtime_conversation_resume_unhandled_failure',
          runId: input.runId,
          errorMessage:
            error instanceof Error ? error.message : 'Conversation resume failed.',
        }),
      );
    }
  }

  async submitMessage(input: {
    threadId: string;
    request: SubmitMessageRequest;
    userId: string;
  }): Promise<SubmitMessagePayload> {
    assertChatRuntimeEnabled();
    const idempotencyKey = input.request.idempotencyKey?.trim();

    if (idempotencyKey) {
      const existingMessage = await this.repository.findUserMessageByIdempotencyKey({
        threadId: input.threadId,
        userId: input.userId,
        idempotencyKey,
      });
      if (existingMessage) {
        await this.repository.seedThreadTitleIfEmpty({
          threadId: input.threadId,
          content: existingMessage.content,
        });
        const run = await this.repository.findLatestRunForUserMessage(existingMessage.id);
        const result = {
          message: existingMessage,
          run,
          deduplicated: true as const,
        };
        return this.finalizeSubmitMessage({
          threadId: input.threadId,
          userId: input.userId,
          message: result.message,
          run: result.run,
          deduplicated: result.deduplicated,
        });
      }
    }

    await this.assertMinimumFastTierCreditsForSubmit({ userId: input.userId });

    const result = await this.repository.submitUserMessage({
      threadId: input.threadId,
      content: input.request.content,
      idempotencyKey: input.request.idempotencyKey,
    });

    return this.finalizeSubmitMessage({
      threadId: input.threadId,
      userId: input.userId,
      message: result.message,
      run: result.run,
      deduplicated: result.deduplicated,
    });
  }

  private async finalizeSubmitMessage(input: {
    threadId: string;
    userId: string;
    message: {
      id: string;
      thread_id: string;
      user_id: string;
      role: 'user' | 'assistant' | 'tool' | 'system';
      content: string;
      content_json: Record<string, unknown> | null;
      idempotency_key: string | null;
      created_at: string;
    };
    run: Parameters<typeof mapRun>[0] | null;
    deduplicated: boolean;
  }): Promise<SubmitMessagePayload> {
    const run = input.run;
    if (run && run.status === 'queued' && isConversationLoopEnabled()) {
      const queuedRun = run;
      void this.executeQueuedRun({
        threadId: input.threadId,
        userId: input.userId,
        userMessage: input.message,
        run: queuedRun,
      });
    }

    return {
      threadId: input.threadId,
      message: mapMessage(input.message),
      run: run ? mapRun(run) : null,
      deduplicated: input.deduplicated,
    };
  }

  private shouldEnforceCreditPrecheck(): boolean {
    return this.billingConfig.billingEnabled && this.billingConfig.creditEnforcementEnabled;
  }

  private async assertMinimumFastTierCreditsForSubmit(input: { userId: string }): Promise<void> {
    if (!this.shouldEnforceCreditPrecheck()) {
      return;
    }

    const balance = await this.entitlements.readSpendableBalance(input.userId);
    if (balance === null) {
      return;
    }

    const snapshot = await this.billingRepository.findPricingRuleSnapshotByVersionKey(
      this.billingConfig.launchPricingVersionKey,
    );
    if (!snapshot) {
      return;
    }

    const pricing = resolvePricingFromSnapshot(
      snapshot.rules_json,
      this.billingConfig.launchCatalog,
    );
    const total = balance.fast;
    if (total < pricing.fastCredits) {
      throw new InsufficientCreditsError();
    }
  }

  async recordRunProviderTrace(input: {
    runId: string;
    providerRequestRaw: Record<string, unknown>;
    providerResponseRaw: Record<string, unknown>;
  }): Promise<void> {
    await this.repository.recordRunProviderTrace(input);
  }

  private async executeQueuedRun(input: {
    threadId: string;
    userId: string;
    userMessage: {
      id: string;
      thread_id: string;
      user_id: string;
      role: 'user' | 'assistant' | 'tool' | 'system';
      content: string;
      content_json: Record<string, unknown> | null;
      idempotency_key: string | null;
      created_at: string;
    };
    run: {
      id: string;
    } & Record<string, unknown>;
  }): Promise<void> {
    try {
      const executedRun = await this.conversationLoop.executeTurn({
        threadId: input.threadId,
        userId: input.userId,
        userMessage: input.userMessage,
        run: input.run as never,
      });
      this.logger.log(
        JSON.stringify({
          event: 'chat_runtime_conversation_turn_completed',
          runId: executedRun.id,
          terminalStatus: executedRun.status,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'chat_runtime_conversation_turn_unhandled_failure',
          runId: input.run.id,
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Conversation loop failed.',
        }),
      );
    }
  }

}

function mapThread(row: {
  id: string;
  user_id: string;
  title: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}): ThreadEnvelope {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapThreadListItem(row: {
  id: string;
  user_id: string;
  title: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  sandbox_status: 'empty' | 'creating' | 'ready' | 'error' | null;
  sandbox_updated_at: string | null;
  experience_html: string | null;
  experience_css: string | null;
  experience_js: string | null;
  experience_title: string | null;
  experience_is_favourite: boolean;
}): ThreadListItemEnvelope {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sandboxStatus: row.sandbox_status,
    sandboxUpdatedAt: row.sandbox_updated_at,
    experienceHtml: row.experience_html,
    experienceCss: row.experience_css,
    experienceJs: row.experience_js,
    experienceTitle: row.experience_title,
    isFavourite: row.experience_is_favourite,
  };
}

function mapMessage(row: {
  id: string;
  thread_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  content_json: Record<string, unknown> | null;
  idempotency_key: string | null;
  created_at: string;
}): ChatMessageEnvelope {
  return {
    id: row.id,
    threadId: row.thread_id,
    userId: row.user_id,
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
  status:
    | 'queued'
    | 'running'
    | 'awaiting_confirmation'
    | 'succeeded'
    | 'failed'
    | 'cancelled';
  confirmation_tool_call_id?: string | null;
  confirmation_metadata?: unknown;
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
    confirmationToolCallId: row.confirmation_tool_call_id ?? null,
    confirmationMetadata: parseToolConfirmationMetadata(row.confirmation_metadata),
  };
}

function parseToolConfirmationMetadata(value: unknown): ToolConfirmationMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const operation = typeof record.operation === 'string' ? record.operation : null;
  const estimated = record.estimatedCredits;
  if (
    !operation ||
    !estimated ||
    typeof estimated !== 'object' ||
    estimated === null ||
    Array.isArray(estimated)
  ) {
    return null;
  }
  const credits = estimated as Record<string, unknown>;
  const fast = typeof credits.fast === 'number' ? credits.fast : Number(credits.fast);
  const quality =
    typeof credits.quality === 'number' ? credits.quality : Number(credits.quality);
  if (!Number.isFinite(fast) || !Number.isFinite(quality)) {
    return null;
  }
  return {
    operation,
    estimatedCredits: { fast, quality },
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
