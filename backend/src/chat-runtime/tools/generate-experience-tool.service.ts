import { Injectable } from '@nestjs/common';
import { AppError, InsufficientCreditsError, ValidationError } from '../../common/errors/app-error';
import { CreditReservationService } from '../../billing/credit-reservation.service';
import { ExperienceOrchestratorService } from '../../experience/services/experience-orchestrator.service';
import { LlmDecisionRouterService } from '../../llm/llm-decision-router.service';
import { LlmConfigService } from '../../llm/llm-config.service';
import { toUsageCounts } from '../../llm/llm-usage';
import type { QualityMode } from '../../llm/llm.types';
import { ChatRuntimeRepository } from '../services/chat-runtime.repository';
import type {
  GenerateExperienceToolArguments,
  GenerateExperienceToolResult,
  GenerateExperienceToolRoute,
} from './generate-experience-tool.types';

@Injectable()
export class GenerateExperienceToolService {
  constructor(
    private readonly decisionRouter: LlmDecisionRouterService,
    private readonly llmConfig: LlmConfigService,
    private readonly orchestrator: ExperienceOrchestratorService,
    private readonly repository: ChatRuntimeRepository,
    private readonly creditReservation: CreditReservationService,
  ) {}

  async execute(input: {
    invocationId: string;
    runId: string;
    threadId: string;
    userId: string;
    arguments: GenerateExperienceToolArguments;
    requestedQualityMode?: QualityMode;
  }): Promise<GenerateExperienceToolResult> {
    const route = await this.selectRoute({
      invocationId: input.invocationId,
      runId: input.runId,
      operation: input.arguments.operation,
      prompt: input.arguments.prompt,
      conversationContext: input.arguments.conversationContext,
      refinementInstruction: input.arguments.refinementInstruction,
      hasPriorExperience:
        input.arguments.operation === 'refine' ||
        input.arguments.priorExperience !== undefined,
      requestedQualityMode: input.requestedQualityMode,
    });

    const generationPrompt = withConversationContext(
      input.arguments.prompt,
      input.arguments.conversationContext,
    );

    let reservedCredits = false;
    let pricingRuleSnapshotId: string | null = null;

    if (this.creditReservation.shouldEnforceReservation()) {
      try {
        const reserved = await this.creditReservation.reserveForToolInvocation({
          userId: input.userId,
          toolInvocationId: input.invocationId,
          qualityTier: route.tier,
        });
        reservedCredits = true;
        pricingRuleSnapshotId = reserved.pricingRuleSnapshotId;
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          await this.repository.updateSandboxState({
            threadId: input.threadId,
            status: 'error',
            lastErrorCode: error.code,
            lastErrorMessage: error.message,
          });
          return {
            status: 'failed',
            generationId: null,
            experienceId: null,
            experienceVersionId: null,
            errorCode: error.code,
            errorMessage: error.message,
            sandboxStatus: 'error',
            route,
          };
        }
        throw error;
      }
    }

    try {
      let payload;
      if (input.arguments.operation === 'generate') {
        payload = await this.orchestrator.generate({
          userId: input.userId,
          prompt: generationPrompt,
          qualityMode: route.tier,
          provider: route.selectedProvider,
        });
      } else {
        // Look up the active experience from the thread's sandbox state.
        // The AI cannot supply priorExperience because tool results are not
        // included in the conversation history sent back to the LLM.
        const sandbox = await this.repository.getSandboxPreview({
          threadId: input.threadId,
          userId: input.userId,
        });
        if (!sandbox.activeExperience) {
          throw new ValidationError(
            'No active experience found in sandbox. Cannot refine.',
          );
        }
        payload = await this.orchestrator.refine({
          userId: input.userId,
          originalPrompt: generationPrompt,
          priorGenerationId: sandbox.activeExperience.generationId,
          refinementInstruction: input.arguments.refinementInstruction!,
          priorExperience: {
            title: sandbox.activeExperience.title,
            description: sandbox.activeExperience.description,
            html: sandbox.activeExperience.html,
            css: sandbox.activeExperience.css,
            js: sandbox.activeExperience.js,
          },
          qualityMode: route.tier,
          provider: route.selectedProvider,
        });
      }

      const versionRef = await this.repository.findExperienceVersionByGenerationId(
        payload.metadata.generationId,
      );

      if (reservedCredits && pricingRuleSnapshotId) {
        if (versionRef?.versionId) {
          await this.creditReservation.settleReservation({
            userId: input.userId,
            toolInvocationId: input.invocationId,
            pricingRuleSnapshotId,
            experienceVersionId: versionRef.versionId,
          });
        } else {
          await this.creditReservation.releaseReservation({
            userId: input.userId,
            toolInvocationId: input.invocationId,
            pricingRuleSnapshotId,
          });
        }
      }

      await this.repository.updateSandboxState({
        threadId: input.threadId,
        status: 'ready',
        experienceId: versionRef?.experienceId ?? null,
        experienceVersionId: versionRef?.versionId ?? null,
        lastErrorCode: null,
        lastErrorMessage: null,
      });

      return {
        status: 'succeeded',
        generationId: payload.metadata.generationId,
        experienceId: versionRef?.experienceId ?? null,
        experienceVersionId: versionRef?.versionId ?? null,
        errorCode: null,
        errorMessage: null,
        sandboxStatus: 'ready',
        route,
      };
    } catch (error) {
      if (reservedCredits && pricingRuleSnapshotId) {
        await this.creditReservation.releaseReservation({
          userId: input.userId,
          toolInvocationId: input.invocationId,
          pricingRuleSnapshotId,
        });
      }

      const errorCode = toErrorCode(error);
      const errorMessage = toErrorMessage(error);

      await this.repository.updateSandboxState({
        threadId: input.threadId,
        status: 'error',
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
      });

      return {
        status: 'failed',
        generationId: null,
        experienceId: null,
        experienceVersionId: null,
        errorCode,
        errorMessage,
        sandboxStatus: 'error',
        route,
      };
    }
  }

  private async selectRoute(input: {
    invocationId: string;
    runId: string;
    operation: 'generate' | 'refine';
    prompt: string;
    conversationContext?: string;
    refinementInstruction?: string;
    hasPriorExperience?: boolean;
    requestedQualityMode?: QualityMode;
  }): Promise<GenerateExperienceToolRoute> {
    if (input.requestedQualityMode) {
      const resolved = this.llmConfig.resolveExecutionRoute({
        tier: input.requestedQualityMode,
      });
      const forcedDecision: GenerateExperienceToolRoute = {
        tier: input.requestedQualityMode,
        confidence: 1,
        reason: `User selected ${input.requestedQualityMode} mode.`,
        fallbackReason: null,
        selectedProvider: resolved.provider,
        selectedModel: resolved.model,
      };

      await this.repository.recordRunRoutingDecision({
        runId: input.runId,
        tier: forcedDecision.tier,
        confidence: forcedDecision.confidence,
        reason: forcedDecision.reason,
        fallbackReason: forcedDecision.fallbackReason,
        selectedProvider: forcedDecision.selectedProvider,
        selectedModel: forcedDecision.selectedModel,
      });

      return forcedDecision;
    }

    const routing = await this.decisionRouter.decideRoute({
      requestId: input.runId,
      operation: input.operation,
      prompt: input.prompt,
      conversationContext: input.conversationContext,
      refinementInstruction: input.refinementInstruction,
      hasPriorExperience: input.hasPriorExperience,
    });
    const decision = routing.decision;

    await this.repository.recordRunRoutingDecision({
      runId: input.runId,
      tier: decision.tier,
      confidence: decision.confidence,
      reason: decision.reason,
      fallbackReason: decision.fallbackReason,
      selectedProvider: decision.selectedProvider,
      selectedModel: decision.selectedModel,
    });

    if (routing.telemetry) {
      const routerUsage = toUsageCounts(routing.telemetry.usage);
      await this.repository.recordToolInvocationRouterTelemetry({
        invocationId: input.invocationId,
        routerProvider: routing.telemetry.provider,
        routerModel: routing.telemetry.model,
        routerRequestRaw: routing.telemetry.requestRaw,
        routerResponseRaw: routing.telemetry.responseRaw,
        routerTokensIn: routerUsage.tokensIn,
        routerTokensOut: routerUsage.tokensOut,
        routerTier: decision.tier,
        routerConfidence: decision.confidence,
        routerReason: decision.reason,
        routerFallbackReason: decision.fallbackReason,
        selectedProvider: decision.selectedProvider,
        selectedModel: decision.selectedModel,
      });
    }

    return decision;
  }
}

function withConversationContext(prompt: string, context?: string): string {
  if (!context || context.trim().length === 0) {
    return prompt;
  }

  return `${prompt}\n\nConversation context:\n${context}`;
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

  return 'Tool execution failed.';
}
