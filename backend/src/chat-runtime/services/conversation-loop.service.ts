import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { LlmConfigService } from '../../llm/llm-config.service';
import type { QualityMode } from '../../llm/llm.types';
import { ToolLlmRouterService } from '../../llm/tool-runtime/tool-llm-router.service';
import type {
  CanonicalChatMessage,
  CanonicalToolCall,
  ProviderContinuationState,
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

    try {
      const requestedQualityMode = extractRequestedQualityMode(input.userMessage);
      const canonicalMessages = await this.buildConversationMessages({
        threadId: input.threadId,
        userId: input.userId,
      });
      let roundMessages: CanonicalChatMessage[] = canonicalMessages;
      let providerContinuation: ProviderContinuationState | undefined;
      let latestToolOperation: 'generate' | 'refine' | null = null;

      for (let round = 0; round <= this.llmConfig.conversationMaxToolRounds; round += 1) {
        const tools = this.toolRegistry.getToolDefinitions();
        let streamedAssistantText = '';
        let hasPublishedAssistantDraft = false;
        this.logger.log(
          JSON.stringify({
            event: 'conversation_loop_round_started',
            runId: input.run.id,
            round,
            toolsAvailable: tools.length,
          }),
        );
        const response = await this.toolLlmRouter.runTurn({
          requestId: input.run.id,
          provider: this.llmConfig.conversationProvider,
          qualityMode: 'quality',
          model: this.llmConfig.conversationModel,
          maxTokens: this.llmConfig.conversationMaxTokens,
          providerContinuation,
          messages: roundMessages,
          tools,
          onAssistantTextSnapshot: async (text) => {
            const normalized = text.trim();
            if (normalized.length === 0) {
              return;
            }

            streamedAssistantText = normalized;
            this.events.publish({
              threadId: input.threadId,
              runId: input.run.id,
              type: hasPublishedAssistantDraft
                ? 'assistant_message_updated'
                : 'assistant_message_started',
              payload: {
                draftId: input.run.id,
                content: normalized,
              },
            });
            hasPublishedAssistantDraft = true;
          },
        });
        providerContinuation = response.providerContinuation;
        const roundToolOperation = extractGenerateExperienceOperation(response.toolCalls);
        if (roundToolOperation) {
          latestToolOperation = roundToolOperation;
        }
        const resolvedAssistantText = resolveAssistantText(
          response.assistantText,
          streamedAssistantText,
        );

        await this.repository.recordRunProviderTrace({
          runId: input.run.id,
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
            runId: input.run.id,
            round,
            finishReason: response.finishReason,
            toolCalls: response.toolCalls.length,
          }),
        );

        if (resolvedAssistantText.length > 0) {
          canonicalMessages.push({
            role: 'assistant',
            content: resolvedAssistantText,
          });
        }

        if (resolvedAssistantText.length > 0 && response.toolCalls.length > 0) {
          const interimAssistantMessage = await this.repository.createAssistantMessage({
            threadId: input.threadId,
            userId: input.userId,
            content: resolvedAssistantText,
            contentJson: {
              phase: 'pre_tool',
              round,
              provider: response.provider,
              model: response.model,
            },
          });
          this.events.publish({
            threadId: input.threadId,
            runId: input.run.id,
            type: 'assistant_message_created',
            payload: toAssistantMessagePayload(interimAssistantMessage),
          });
        }

        if (response.toolCalls.length === 0) {
          const completedRun = await this.completeWithAssistantMessage({
            runId: input.run.id,
            threadId: input.threadId,
            userId: input.userId,
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
              runId: input.run.id,
              durationMs: Date.now() - runStartedAt,
              terminalStatus: completedRun.status,
            }),
          );
          return completedRun;
        }

        const toolResultMessages: CanonicalChatMessage[] = [];
        for (const toolCall of response.toolCalls) {
          const invocation = await this.repository.createToolInvocation({
            threadId: input.threadId,
            runId: input.run.id,
            providerToolCallId: toolCall.id,
            toolName: toolCall.name,
            toolArguments: toolCall.arguments,
          });

          this.events.publish({
            threadId: input.threadId,
            runId: input.run.id,
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
              runId: input.run.id,
              type: 'sandbox_updated',
              payload: {
                status: 'creating',
              },
            });
          }

          if (!this.toolRegistry.hasTool(toolCall.name)) {
            const errorResult = {
              status: 'failed',
              generationId: null,
              experienceId: null,
              experienceVersionId: null,
              errorCode: 'UNKNOWN_TOOL',
              errorMessage: `Unknown tool: ${toolCall.name}`,
              sandboxStatus: 'error',
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
              runId: input.run.id,
              type: 'tool_failed',
              payload: {
                invocationId: invocation.id,
                toolName: toolCall.name,
                errorCode: errorResult.errorCode,
                errorMessage: errorResult.errorMessage,
              },
            });

            canonicalMessages.push({
              role: 'tool',
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              content: JSON.stringify(errorResult),
            });
            toolResultMessages.push({
              role: 'tool',
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              content: JSON.stringify(errorResult),
            });
            continue;
          }

          const execution = await this.toolRegistry.executeToolCall({
            threadId: input.threadId,
            runId: input.run.id,
            userId: input.userId,
            toolCallId: toolCall.id,
            name: toolCall.name,
            arguments: toolCall.arguments,
            conversationContext: buildBoundedConversationContext(canonicalMessages),
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
              runId: input.run.id,
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
              runId: input.run.id,
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
              runId: input.run.id,
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
              experienceId: execution.result.experienceId,
              experienceVersionId: execution.result.experienceVersionId,
              lastErrorCode: execution.result.errorCode,
              lastErrorMessage: execution.result.errorMessage,
            });

            this.events.publish({
              threadId: input.threadId,
              runId: input.run.id,
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

          canonicalMessages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: JSON.stringify(execution.result),
          });
          toolResultMessages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: JSON.stringify(execution.result),
          });
        }

        roundMessages = canonicalMessages;
        if (
          response.provider === 'openai' &&
          providerContinuation?.openai &&
          toolResultMessages.length > 0
        ) {
          roundMessages = toolResultMessages;
        }
      }

      throw new AppError(
        'INTERNAL_ERROR',
        'Conversation loop exceeded configured tool-call rounds.',
        500,
      );
    } catch (error) {
      const code = toErrorCode(error);
      const message = toErrorMessage(error);

      await this.repository.markRunFailed({
        runId: input.run.id,
        errorCode: code,
        errorMessage: message,
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

  private async buildConversationMessages(input: {
    threadId: string;
    userId: string;
  }): Promise<CanonicalChatMessage[]> {
    const hydration = await this.repository.hydrateThread({
      threadId: input.threadId,
      userId: input.userId,
    });

    const baseMessages = hydration.messages.map(mapPersistedMessageToCanonical);
    const filteredMessages = baseMessages.filter((message) => message.role !== 'tool');
    return [
      {
        role: 'system',
        content: this.llmConfig.conversationSystemPrompt,
      },
      ...filteredMessages,
    ];
  }

  private async completeWithAssistantMessage(input: {
    runId: string;
    threadId: string;
    userId: string;
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

    await this.repository.markRunSucceeded({
      runId: input.runId,
      assistantMessageId: assistantMessage.id,
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

  return {
    role: message.role,
    content: message.content,
  };
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

function extractRequestedQualityMode(message: ChatMessageRow): QualityMode | undefined {
  const value = message.content_json?.generationMode;
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
