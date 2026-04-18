import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { LlmConfigService } from '../../llm/llm-config.service';
import {
  aggregateObservedUsage,
  toUsageCounts,
  type LlmUsageTelemetry,
} from '../../llm/llm-usage';
import type { QualityMode } from '../../llm/llm.types';
import { ToolLlmRouterService } from '../../llm/tool-runtime/tool-llm-router.service';
import type {
  CanonicalChatMessage,
  CanonicalToolCall,
} from '../../llm/tool-runtime/tool-runtime.types';
import type { Database } from '../../supabase/supabase.types';
import { ChatToolRegistryService } from '../tools/chat-tool-registry.service';
import { ChatRuntimeEventService } from './chat-runtime-event.service';
import { ChatRuntimeRepository } from './chat-runtime.repository';

type ConversationRunRow = Database['public']['Tables']['assistant_runs']['Row'];
type ChatMessageRow = Database['public']['Tables']['chat_messages']['Row'];

@Injectable()
export class ConversationLoopService {
  private readonly logger = new Logger(ConversationLoopService.name);

  constructor(
    private readonly repository: ChatRuntimeRepository,
    private readonly events: ChatRuntimeEventService,
    private readonly toolRegistry: ChatToolRegistryService,
    private readonly toolLlmRouter: ToolLlmRouterService,
    private readonly llmConfig: LlmConfigService,
  ) {}

  async executeTurn(input: {
    threadId: string;
    userId: string;
    userMessage: ChatMessageRow;
    run: ConversationRunRow;
  }): Promise<ConversationRunRow> {
    if (input.run.status !== 'queued') {
      return input.run;
    }

    const runStartedAt = Date.now();
    await this.repository.markRunRunning(input.run.id, {
      conversationProvider: this.llmConfig.conversationProvider,
      conversationModel: this.llmConfig.conversationModel,
    });
    this.events.publish({
      threadId: input.threadId,
      runId: input.run.id,
      type: 'run_started',
      payload: {
        runId: input.run.id,
        provider: this.llmConfig.conversationProvider,
        model: this.llmConfig.conversationModel,
      },
    });
    const completedRoundUsages: LlmUsageTelemetry[] = [];

    try {
      const canonicalMessages = await this.buildConversationMessages({
        threadId: input.threadId,
        userId: input.userId,
      });
      return await this.runConversationRounds({
        threadId: input.threadId,
        userId: input.userId,
        userMessage: input.userMessage,
        runId: input.run.id,
        canonicalMessages,
        completedRoundUsages,
        runStartedAt,
        startRound: 0,
      });
    } catch (error) {
      const code = toErrorCode(error);
      const message = toErrorMessage(error);
      const conversationUsage = toUsageCounts(aggregateObservedUsage(completedRoundUsages));

      await this.repository.markRunFailed({
        runId: input.run.id,
        errorCode: code,
        errorMessage: message,
        conversationTokensIn: conversationUsage.tokensIn,
        conversationTokensOut: conversationUsage.tokensOut,
      });
      this.events.publish({
        threadId: input.threadId,
        runId: input.run.id,
        type: 'run_failed',
        payload: {
          runId: input.run.id,
          errorCode: code,
          errorMessage: message,
        },
      });

      this.logger.error(
        JSON.stringify({
          event: 'conversation_loop_failed',
          threadId: input.threadId,
          runId: input.run.id,
          errorCode: code,
          errorMessage: message,
        }),
      );

      const failedRun = await this.repository.getRunById(input.run.id);
      if (!failedRun) {
        throw new AppError('INTERNAL_ERROR', 'Conversation run record was not found.', 500);
      }

      return failedRun;
    }
  }

  async resumeTurn(input: {
    threadId: string;
    userId: string;
    runId: string;
    confirmedToolCallId: string;
    decision: 'confirmed' | 'cancelled';
    qualityMode?: QualityMode;
    userMessage: ChatMessageRow;
  }): Promise<ConversationRunRow> {
    const runStartedAt = Date.now();
    const completedRoundUsages: LlmUsageTelemetry[] = [];

    const run = await this.repository.getRunById(input.runId);
    if (!run || run.status !== 'awaiting_confirmation') {
      throw new AppError(
        'VALIDATION_ERROR',
        'Run is not awaiting confirmation.',
        400,
      );
    }
    if (run.thread_id !== input.threadId) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Run does not belong to this thread.',
        400,
      );
    }
    if (run.confirmation_tool_call_id !== input.confirmedToolCallId) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Confirmation does not match the pending tool call.',
        400,
      );
    }

    await this.repository.assertThreadAccess({
      threadId: input.threadId,
      userId: input.userId,
    });

    await this.repository.markRunRunningFromConfirmation(input.runId);

    try {
      const canonicalMessages = await this.buildConversationMessages({
        threadId: input.threadId,
        userId: input.userId,
      });

      if (input.decision === 'cancelled') {
        const context = findToolCallContext(canonicalMessages, input.confirmedToolCallId);
        const toolName = context?.name ?? 'generate_experience';
        const toolArguments = context?.arguments ?? {};

        const invocation = await this.repository.findToolInvocationByRunAndProviderToolCallId({
          runId: input.runId,
          providerToolCallId: input.confirmedToolCallId,
        });

        const operation = toolOperationForLlmPayload(toolName, toolArguments);
        const cancelPayload = { status: 'cancelled' as const, operation };

        if (invocation) {
          await this.repository.markToolInvocationFailed({
            invocationId: invocation.id,
            errorCode: 'USER_CANCELLED',
            errorMessage: 'User cancelled before generation started.',
            toolResult: cancelPayload,
          });

          this.events.publish({
            threadId: input.threadId,
            runId: input.runId,
            type: 'tool_failed',
            payload: {
              invocationId: invocation.id,
              toolName: invocation.tool_name,
              errorCode: 'USER_CANCELLED',
              errorMessage: 'User cancelled before generation started.',
            },
          });
        }

        const llmToolContent = JSON.stringify(cancelPayload);
        await this.repository.createToolResultMessage({
          threadId: input.threadId,
          userId: input.userId,
          toolCallId: input.confirmedToolCallId,
          toolName,
          content: llmToolContent,
        });

        canonicalMessages.push({
          role: 'tool',
          toolCallId: input.confirmedToolCallId,
          toolName,
          content: llmToolContent,
        });
      } else {
        const pendingForSet = derivePendingToolCallsForRun(canonicalMessages);
        if (pendingForSet.length === 0) {
          throw new AppError('INTERNAL_ERROR', 'No pending tool calls found on resume.', 500);
        }

        const toolSetResult = await this.executeToolCallSet({
          threadId: input.threadId,
          userId: input.userId,
          runId: input.runId,
          toolCalls: pendingForSet,
          canonicalMessages,
          confirmationBypass: {
            toolCallId: input.confirmedToolCallId,
            qualityMode: input.qualityMode ?? 'fast',
          },
        });

        if (toolSetResult.status === 'paused') {
          const paused = await this.repository.getRunById(input.runId);
          if (!paused) {
            throw new AppError('INTERNAL_ERROR', 'Conversation run record was not found.', 500);
          }
          return paused;
        }
      }

      const resumedRun = await this.repository.getRunById(input.runId);
      if (!resumedRun) {
        throw new AppError('INTERNAL_ERROR', 'Conversation run record was not found.', 500);
      }

      return await this.runConversationRounds({
        threadId: input.threadId,
        userId: input.userId,
        userMessage: input.userMessage,
        runId: input.runId,
        canonicalMessages,
        completedRoundUsages,
        runStartedAt,
        startRound: computeNextConversationRoundIndex(resumedRun),
      });
    } catch (error) {
      const code = toErrorCode(error);
      const message = toErrorMessage(error);
      const conversationUsage = toUsageCounts(aggregateObservedUsage(completedRoundUsages));

      await this.repository.markRunFailed({
        runId: input.runId,
        errorCode: code,
        errorMessage: message,
        conversationTokensIn: conversationUsage.tokensIn,
        conversationTokensOut: conversationUsage.tokensOut,
      });
      this.events.publish({
        threadId: input.threadId,
        runId: input.runId,
        type: 'run_failed',
        payload: {
          runId: input.runId,
          errorCode: code,
          errorMessage: message,
        },
      });

      this.logger.error(
        JSON.stringify({
          event: 'conversation_loop_resume_failed',
          threadId: input.threadId,
          runId: input.runId,
          errorCode: code,
          errorMessage: message,
        }),
      );

      const failedRun = await this.repository.getRunById(input.runId);
      if (!failedRun) {
        throw new AppError('INTERNAL_ERROR', 'Conversation run record was not found.', 500);
      }

      return failedRun;
    }
  }

  private async runConversationRounds(input: {
    threadId: string;
    userId: string;
    userMessage: ChatMessageRow;
    runId: string;
    canonicalMessages: CanonicalChatMessage[];
    completedRoundUsages: LlmUsageTelemetry[];
    runStartedAt: number;
    startRound: number;
  }): Promise<ConversationRunRow> {
    const canonicalMessages = input.canonicalMessages;
    let roundMessages: CanonicalChatMessage[] = canonicalMessages;
    let latestToolOperation: 'generate' | 'refine' | null = null;
    void input.userMessage;

    for (
      let round = input.startRound;
      round <= this.llmConfig.conversationMaxToolRounds;
      round += 1
    ) {
      const tools = this.toolRegistry.getToolDefinitions();
      let streamedAssistantText = '';
      let hasPublishedAssistantDraft = false;
      this.logger.log(
        JSON.stringify({
          event: 'conversation_loop_round_started',
          runId: input.runId,
          round,
          toolsAvailable: tools.length,
        }),
      );
      const response = await this.toolLlmRouter.runTurn({
        requestId: input.runId,
        provider: this.llmConfig.conversationProvider,
        qualityMode: 'quality',
        model: this.llmConfig.conversationModel,
        maxTokens: this.llmConfig.conversationMaxTokens,
        messages: cloneCanonicalMessagesForProviderRequest(roundMessages),
        tools,
        onAssistantTextSnapshot: async (text) => {
          const normalized = text.trim();
          if (normalized.length === 0) {
            return;
          }

          streamedAssistantText = normalized;
          this.events.publish({
            threadId: input.threadId,
            runId: input.runId,
            type: hasPublishedAssistantDraft
              ? 'assistant_message_updated'
              : 'assistant_message_started',
            payload: {
              draftId: input.runId,
              content: normalized,
            },
          });
          hasPublishedAssistantDraft = true;
        },
      });
      input.completedRoundUsages.push(response.usage);
      const roundToolOperation = extractGenerateExperienceOperation(response.toolCalls);
      if (roundToolOperation) {
        latestToolOperation = roundToolOperation;
      }
      const resolvedAssistantText = resolveAssistantText(
        response.assistantText,
        streamedAssistantText,
      );

      await this.repository.recordRunProviderTrace({
        runId: input.runId,
        providerRequestRaw: appendMontiTrace(response.rawRequest, {
          round,
          tool_operation: latestToolOperation,
        }),
        providerResponseRaw: appendMontiTrace(response.rawResponse, {
          round,
          tool_operation: latestToolOperation,
        }),
      });

      this.logger.log(
        JSON.stringify({
          event: 'conversation_loop_round_completed',
          runId: input.runId,
          round,
          finishReason: response.finishReason,
          toolCalls: response.toolCalls.length,
        }),
      );

      if (response.toolCalls.length > 0) {
        canonicalMessages.push({
          role: 'assistant',
          content: resolvedAssistantText,
          toolCalls: response.toolCalls,
        });

        const toolCallAssistantMessage = await this.repository.createToolCallMessage({
          threadId: input.threadId,
          userId: input.userId,
          content: resolvedAssistantText,
          toolCalls: response.toolCalls,
          contentJson: {
            phase: 'pre_tool',
            round,
            provider: response.provider,
            model: response.model,
          },
        });
        this.events.publish({
          threadId: input.threadId,
          runId: input.runId,
          type: 'assistant_message_created',
          payload: toAssistantMessagePayload(toolCallAssistantMessage),
        });
      } else if (resolvedAssistantText.length > 0) {
        canonicalMessages.push({
          role: 'assistant',
          content: resolvedAssistantText,
        });
      }

      if (response.toolCalls.length === 0) {
        const completedRun = await this.completeWithAssistantMessage({
          runId: input.runId,
          threadId: input.threadId,
          userId: input.userId,
          conversationUsage: aggregateObservedUsage(input.completedRoundUsages),
          content:
            resolvedAssistantText.length > 0
              ? resolvedAssistantText
              : 'I finished that step. Tell me what you want to do next.',
          contentJson: {
            provider: response.provider,
            model: response.model,
            finishReason: response.finishReason,
          },
        });
        this.logger.log(
          JSON.stringify({
            event: 'conversation_loop_completed',
            runId: input.runId,
            durationMs: Date.now() - input.runStartedAt,
            terminalStatus: completedRun.status,
          }),
        );
        return completedRun;
      }

      const toolSetResult = await this.executeToolCallSet({
        threadId: input.threadId,
        userId: input.userId,
        runId: input.runId,
        toolCalls: response.toolCalls,
        canonicalMessages,
      });

      if (toolSetResult.status === 'paused') {
        const pausedRun = await this.repository.getRunById(input.runId);
        if (!pausedRun) {
          throw new AppError('INTERNAL_ERROR', 'Conversation run record was not found.', 500);
        }
        this.logger.log(
          JSON.stringify({
            event: 'conversation_loop_paused_for_confirmation',
            runId: input.runId,
            durationMs: Date.now() - input.runStartedAt,
          }),
        );
        return pausedRun;
      }

      roundMessages = canonicalMessages;
    }

    throw new AppError(
      'INTERNAL_ERROR',
      'Conversation loop exceeded configured tool-call rounds.',
      500,
    );
  }

  private async executeToolCallSet(input: {
    threadId: string;
    userId: string;
    runId: string;
    toolCalls: CanonicalToolCall[];
    canonicalMessages: CanonicalChatMessage[];
    confirmationBypass?: { toolCallId: string; qualityMode: QualityMode };
  }): Promise<{ status: 'completed' } | { status: 'paused' }> {
    for (const toolCall of input.toolCalls) {
      const invocation = await this.repository.createToolInvocation({
        threadId: input.threadId,
        runId: input.runId,
        providerToolCallId: toolCall.id,
        toolName: toolCall.name,
        toolArguments: toolCall.arguments,
      });

      const chatTool = this.toolRegistry.getTool(toolCall.name);

      if (!chatTool) {
        const errorResult = {
          status: 'failed' as const,
          generationId: null,
          experienceId: null,
          experienceVersionId: null,
          errorCode: 'UNKNOWN_TOOL',
          errorMessage: `Unknown tool: ${toolCall.name}`,
          sandboxStatus: 'error' as const,
          route: null,
        };

        await this.repository.markToolInvocationFailed({
          invocationId: invocation.id,
          errorCode: errorResult.errorCode,
          errorMessage: errorResult.errorMessage,
          toolResult: errorResult,
          routerTier: null,
          routerConfidence: null,
          routerReason: null,
          routerFallbackReason: null,
          selectedProvider: null,
          selectedModel: null,
        });

        this.events.publish({
          threadId: input.threadId,
          runId: input.runId,
          type: 'tool_failed',
          payload: {
            invocationId: invocation.id,
            toolName: toolCall.name,
            errorCode: errorResult.errorCode,
            errorMessage: errorResult.errorMessage,
          },
        });

        const llmToolContent = buildLlmFacingToolResultContent(
          toolCall.name,
          toolCall.arguments,
          errorResult,
        );
        await this.repository.createToolResultMessage({
          threadId: input.threadId,
          userId: input.userId,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: llmToolContent,
        });

        input.canonicalMessages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: llmToolContent,
        });
        continue;
      }

      const shouldPauseForConfirmation =
        chatTool.requiresConfirmation(toolCall.arguments) &&
        !(
          input.confirmationBypass &&
          input.confirmationBypass.toolCallId === toolCall.id
        );

      if (shouldPauseForConfirmation) {
        const metadata = chatTool.getConfirmationMetadata(toolCall.arguments);
        await this.repository.markRunAwaitingConfirmation({
          runId: input.runId,
          confirmationToolCallId: toolCall.id,
          confirmationMetadata: {
            operation: metadata.operation,
            estimatedCredits: metadata.estimatedCredits,
          },
        });
        this.events.publish({
          threadId: input.threadId,
          runId: input.runId,
          type: 'confirmation_required',
          payload: {
            toolCallId: toolCall.id,
            operation: metadata.operation,
            estimatedCredits: metadata.estimatedCredits,
          },
        });
        return { status: 'paused' };
      }

      const requestedQualityMode =
        input.confirmationBypass?.toolCallId === toolCall.id
          ? input.confirmationBypass.qualityMode
          : undefined;

      this.events.publish({
        threadId: input.threadId,
        runId: input.runId,
        type: 'tool_started',
        payload: {
          invocationId: invocation.id,
          toolName: invocation.tool_name,
        },
      });

      if (toolCall.name === 'generate_experience') {
        await this.repository.updateSandboxState({
          threadId: input.threadId,
          status: 'creating',
          lastErrorCode: null,
          lastErrorMessage: null,
        });
        this.events.publish({
          threadId: input.threadId,
          runId: input.runId,
          type: 'sandbox_updated',
          payload: {
            status: 'creating',
          },
        });
      }

      const execution = await this.toolRegistry.executeToolCall({
        invocationId: invocation.id,
        threadId: input.threadId,
        runId: input.runId,
        userId: input.userId,
        toolCallId: toolCall.id,
        name: toolCall.name,
        arguments: toolCall.arguments,
        conversationContext: buildBoundedConversationContext(input.canonicalMessages),
        requestedQualityMode,
      });

      if (execution.result.status === 'succeeded') {
        await this.repository.markToolInvocationSucceeded({
          invocationId: invocation.id,
          toolResult: execution.result as unknown as Record<string, unknown>,
          generationId: execution.result.generationId,
          experienceId: execution.result.experienceId,
          experienceVersionId: execution.result.experienceVersionId,
          routerTier: execution.result.route?.tier ?? null,
          routerConfidence: execution.result.route?.confidence ?? null,
          routerReason: execution.result.route?.reason ?? null,
          routerFallbackReason: execution.result.route?.fallbackReason ?? null,
          selectedProvider: execution.result.route?.selectedProvider ?? null,
          selectedModel: execution.result.route?.selectedModel ?? null,
        });

        let resolvedExperienceId = execution.result.experienceId;
        let resolvedExperienceVersionId = execution.result.experienceVersionId;
        if (!resolvedExperienceVersionId && execution.result.generationId) {
          const versionRef = await this.repository.findExperienceVersionByGenerationId(
            execution.result.generationId,
          );
          resolvedExperienceId = versionRef?.experienceId ?? resolvedExperienceId;
          resolvedExperienceVersionId =
            versionRef?.versionId ?? resolvedExperienceVersionId;
        }

        this.events.publish({
          threadId: input.threadId,
          runId: input.runId,
          type: 'tool_succeeded',
          payload: {
            invocationId: invocation.id,
            toolName: toolCall.name,
            generationId: execution.result.generationId,
          },
        });

        await this.repository.updateSandboxState({
          threadId: input.threadId,
          status: execution.result.sandboxStatus,
          experienceId: resolvedExperienceId,
          experienceVersionId: resolvedExperienceVersionId,
          lastErrorCode: null,
          lastErrorMessage: null,
        });

        this.events.publish({
          threadId: input.threadId,
          runId: input.runId,
          type: 'sandbox_updated',
          payload: {
            status: execution.result.sandboxStatus,
            experienceId: resolvedExperienceId,
            experienceVersionId: resolvedExperienceVersionId,
            errorCode: null,
            errorMessage: null,
          },
        });
      } else {
        await this.repository.markToolInvocationFailed({
          invocationId: invocation.id,
          errorCode: execution.result.errorCode ?? 'TOOL_EXECUTION_FAILED',
          errorMessage:
            execution.result.errorMessage ?? 'Tool execution failed.',
          toolResult: execution.result as unknown as Record<string, unknown>,
          routerTier: execution.result.route?.tier ?? null,
          routerConfidence: execution.result.route?.confidence ?? null,
          routerReason: execution.result.route?.reason ?? null,
          routerFallbackReason: execution.result.route?.fallbackReason ?? null,
          selectedProvider: execution.result.route?.selectedProvider ?? null,
          selectedModel: execution.result.route?.selectedModel ?? null,
        });

        this.events.publish({
          threadId: input.threadId,
          runId: input.runId,
          type: 'tool_failed',
          payload: {
            invocationId: invocation.id,
            toolName: toolCall.name,
            errorCode: execution.result.errorCode,
            errorMessage: execution.result.errorMessage,
          },
        });

        await this.repository.updateSandboxState({
          threadId: input.threadId,
          status: execution.result.sandboxStatus,
          ...(execution.result.experienceId != null
            ? { experienceId: execution.result.experienceId }
            : {}),
          ...(execution.result.experienceVersionId != null
            ? { experienceVersionId: execution.result.experienceVersionId }
            : {}),
          lastErrorCode: execution.result.errorCode,
          lastErrorMessage: execution.result.errorMessage,
        });

        this.events.publish({
          threadId: input.threadId,
          runId: input.runId,
          type: 'sandbox_updated',
          payload: {
            status: execution.result.sandboxStatus,
            experienceId: execution.result.experienceId,
            experienceVersionId: execution.result.experienceVersionId,
            errorCode: execution.result.errorCode,
            errorMessage: execution.result.errorMessage,
          },
        });
      }

      const llmToolContent = buildLlmFacingToolResultContent(
        toolCall.name,
        toolCall.arguments,
        execution.result as unknown as Record<string, unknown>,
      );
      await this.repository.createToolResultMessage({
        threadId: input.threadId,
        userId: input.userId,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: llmToolContent,
      });

      input.canonicalMessages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: llmToolContent,
      });
    }

    return { status: 'completed' };
  }

  private async buildConversationMessages(input: {
    threadId: string;
    userId: string;
  }): Promise<CanonicalChatMessage[]> {
    const hydration = await this.repository.hydrateThread({
      threadId: input.threadId,
      userId: input.userId,
    });

    const baseMessages = hydration.messages.map(mapPersistedMessageToCanonical);
    const windowedMessages = applyConversationMessageWindow(
      baseMessages,
      this.llmConfig.conversationContextWindowSize,
    );
    return [
      {
        role: 'system',
        content: this.llmConfig.conversationSystemPrompt,
      },
      ...windowedMessages,
    ];
  }

  private async completeWithAssistantMessage(input: {
    runId: string;
    threadId: string;
    userId: string;
    conversationUsage: ReturnType<typeof aggregateObservedUsage>;
    content: string;
    contentJson?: Record<string, unknown>;
  }): Promise<ConversationRunRow> {
    const assistantMessage = await this.repository.createAssistantMessage({
      threadId: input.threadId,
      userId: input.userId,
      content: input.content,
      contentJson: input.contentJson ?? null,
    });

    this.events.publish({
      threadId: input.threadId,
      runId: input.runId,
      type: 'assistant_message_created',
      payload: toAssistantMessagePayload(assistantMessage),
    });

    const conversationUsage = toUsageCounts(input.conversationUsage);
    await this.repository.markRunSucceeded({
      runId: input.runId,
      assistantMessageId: assistantMessage.id,
      conversationTokensIn: conversationUsage.tokensIn,
      conversationTokensOut: conversationUsage.tokensOut,
    });

    this.events.publish({
      threadId: input.threadId,
      runId: input.runId,
      type: 'run_completed',
      payload: {
        runId: input.runId,
      },
    });

    const completedRun = await this.repository.getRunById(input.runId);
    if (!completedRun) {
      throw new AppError('INTERNAL_ERROR', 'Conversation run record was not found.', 500);
    }

    return completedRun;
  }
}

function mapPersistedMessageToCanonical(message: ChatMessageRow): CanonicalChatMessage {
  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content,
      toolCallId:
        typeof message.content_json?.toolCallId === 'string'
          ? message.content_json.toolCallId
          : undefined,
      toolName:
        typeof message.content_json?.toolName === 'string'
          ? message.content_json.toolName
          : undefined,
    };
  }

  if (message.role === 'assistant') {
    const toolCalls = parseStoredAssistantToolCalls(message.content_json?.toolCalls);
    return {
      role: 'assistant',
      content: message.content,
      ...(toolCalls ? { toolCalls } : {}),
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
}

function parseStoredAssistantToolCalls(value: unknown): CanonicalToolCall[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parsed: CanonicalToolCall[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : null;
    const name = typeof record.name === 'string' ? record.name : null;
    if (!id || !name) {
      continue;
    }

    const args = record.arguments;
    parsed.push({
      id,
      name,
      arguments:
        typeof args === 'object' && args !== null && !Array.isArray(args)
          ? (args as Record<string, unknown>)
          : {},
    });
  }

  return parsed.length > 0 ? parsed : undefined;
}

/** Exported for unit tests — snaps window start to a `user` role boundary. */
export function applyConversationMessageWindow(
  messages: CanonicalChatMessage[],
  windowSize: number,
): CanonicalChatMessage[] {
  if (messages.length === 0 || windowSize <= 0) {
    return messages;
  }

  if (messages.length <= windowSize) {
    return messages.slice(snapConversationWindowStartIndex(messages, 0));
  }

  const rawStart = messages.length - windowSize;
  const start = snapConversationWindowStartIndex(messages, rawStart);
  return messages.slice(start);
}

function snapConversationWindowStartIndex(
  messages: CanonicalChatMessage[],
  start: number,
): number {
  let index = Math.max(0, Math.min(start, messages.length - 1));
  while (index > 0 && messages[index].role !== 'user') {
    index -= 1;
  }

  return index;
}

function buildLlmFacingToolResultContent(
  toolName: string,
  toolArguments: Record<string, unknown>,
  result: Record<string, unknown>,
): string {
  const operation = toolOperationForLlmPayload(toolName, toolArguments);

  if (result.status === 'succeeded') {
    return JSON.stringify({ status: 'succeeded', operation });
  }

  if (result.status === 'cancelled') {
    return JSON.stringify({ status: 'cancelled', operation });
  }

  const errorCode =
    typeof result.errorCode === 'string' && result.errorCode.length > 0
      ? result.errorCode
      : 'TOOL_FAILED';
  const errorMessage =
    typeof result.errorMessage === 'string' && result.errorMessage.length > 0
      ? result.errorMessage
      : 'Tool execution failed.';

  return JSON.stringify({
    status: 'failed',
    operation,
    errorCode,
    errorMessage,
  });
}

function toolOperationForLlmPayload(
  toolName: string,
  toolArguments: Record<string, unknown>,
): string {
  if (
    toolName === 'generate_experience' &&
    (toolArguments.operation === 'generate' || toolArguments.operation === 'refine')
  ) {
    return toolArguments.operation;
  }
  if (toolName === 'generate_experience') {
    return 'generate';
  }
  return 'invoke';
}

function computeNextConversationRoundIndex(run: ConversationRunRow): number {
  const last = readLastTraceRoundFromRun(run);
  return last == null ? 0 : last + 1;
}

function readLastTraceRoundFromRun(run: ConversationRunRow): number | null {
  let last: number | null = null;
  for (const raw of [run.provider_response_raw, run.provider_request_raw]) {
    const r = extractTraceRound(raw);
    if (r != null) {
      last = r;
    }
  }
  return last;
}

function extractTraceRound(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object' || raw === null) {
    return null;
  }
  const trace = (raw as Record<string, unknown>)._montiTrace;
  if (!trace || typeof trace !== 'object' || trace === null) {
    return null;
  }
  const round = (trace as Record<string, unknown>).round;
  return typeof round === 'number' ? round : null;
}

function derivePendingToolCallsForRun(messages: CanonicalChatMessage[]): CanonicalToolCall[] {
  const completedIds = new Set(
    messages
      .filter((m) => m.role === 'tool' && m.toolCallId)
      .map((m) => m.toolCallId as string),
  );

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== 'assistant' || !m.toolCalls?.length) {
      continue;
    }
    return m.toolCalls.filter((tc) => !completedIds.has(tc.id));
  }
  return [];
}

function findToolCallContext(
  messages: CanonicalChatMessage[],
  toolCallId: string,
): { name: string; arguments: Record<string, unknown> } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== 'assistant' || !m.toolCalls?.length) {
      continue;
    }
    const hit = m.toolCalls.find((c) => c.id === toolCallId);
    if (hit) {
      return { name: hit.name, arguments: hit.arguments };
    }
  }
  return null;
}

function toErrorCode(error: unknown): string {
  if (error instanceof AppError) {
    return error.code;
  }

  if (error instanceof Error && error.name.trim().length > 0) {
    return error.name;
  }

  return 'UNKNOWN_ERROR';
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Conversation loop failed.';
}

function resolveAssistantText(
  assistantText: string,
  streamedAssistantText: string,
): string {
  const direct = assistantText.trim();
  if (direct.length > 0) {
    return direct;
  }

  return streamedAssistantText.trim();
}

function buildBoundedConversationContext(messages: CanonicalChatMessage[]): string {
  const relevant = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`);

  return relevant.join('\n');
}

/** @deprecated Mode is chosen at the confirmation gate; kept for legacy rows. */
export function extractRequestedQualityMode(message: ChatMessageRow): QualityMode | undefined {
  const value = message.content_json?.generationMode;
  if (value === 'auto') {
    return undefined;
  }
  if (value === 'fast' || value === 'quality') {
    return value;
  }

  return undefined;
}

function toAssistantMessagePayload(message: ChatMessageRow): Record<string, unknown> {
  return {
    messageId: message.id,
    message: {
      id: message.id,
      threadId: message.thread_id,
      userId: message.user_id,
      role: message.role,
      content: message.content,
      contentJson: message.content_json,
      idempotencyKey: message.idempotency_key,
      createdAt: message.created_at,
    },
  };
}

function extractGenerateExperienceOperation(
  toolCalls: CanonicalToolCall[],
): 'generate' | 'refine' | null {
  for (const toolCall of toolCalls) {
    if (toolCall.name !== 'generate_experience') {
      continue;
    }

    const operation = toolCall.arguments.operation;
    if (operation === 'generate' || operation === 'refine') {
      return operation;
    }
  }

  return null;
}

function cloneCanonicalMessagesForProviderRequest(
  messages: CanonicalChatMessage[],
): CanonicalChatMessage[] {
  return messages.map((message) =>
    message.toolCalls
      ? {
          ...message,
          toolCalls: message.toolCalls.map((call) => ({
            ...call,
            arguments: { ...call.arguments },
          })),
        }
      : { ...message },
  );
}

function appendMontiTrace(
  raw: Record<string, unknown>,
  telemetry: {
    round: number;
    tool_operation: 'generate' | 'refine' | null;
  },
): Record<string, unknown> {
  const currentTrace =
    typeof raw._montiTrace === 'object' && raw._montiTrace !== null
      ? (raw._montiTrace as Record<string, unknown>)
      : {};

  return {
    ...raw,
    _montiTrace: {
      ...currentTrace,
      ...telemetry,
    },
  };
}
