import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { ExperienceOrchestratorService } from '../../experience/services/experience-orchestrator.service';
import { LlmDecisionRouterService } from '../../llm/llm-decision-router.service';
import { LlmConfigService } from '../../llm/llm-config.service';
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
  ) {}

  async execute(input: {
    runId: string;
    threadId: string;
    userId: string;
    arguments: GenerateExperienceToolArguments;
    requestedQualityMode?: QualityMode;
  }): Promise<GenerateExperienceToolResult> {
    const route = await this.selectRoute({
      runId: input.runId,
      operation: input.arguments.operation,
      prompt: input.arguments.prompt,
      format: input.arguments.format,
      audience: input.arguments.audience,
      conversationContext: input.arguments.conversationContext,
      refinementInstruction: input.arguments.refinementInstruction,
      hasPriorExperience: input.arguments.priorExperience !== undefined,
      requestedQualityMode: input.requestedQualityMode,
    });

    const generationPrompt = withConversationContext(
      input.arguments.prompt,
      input.arguments.conversationContext,
    );

    try {
      const payload =
        input.arguments.operation === 'generate'
          ? await this.orchestrator.generate({
              userId: input.userId,
              prompt: generationPrompt,
              format: input.arguments.format,
              audience: input.arguments.audience,
              qualityMode: route.tier,
              provider: route.selectedProvider,
            })
          : await this.orchestrator.refine({
              userId: input.userId,
              originalPrompt: generationPrompt,
              priorGenerationId: input.arguments.priorGenerationId!,
              refinementInstruction: input.arguments.refinementInstruction!,
              priorExperience: input.arguments.priorExperience!,
              qualityMode: route.tier,
              provider: route.selectedProvider,
            });

      const versionRef = await this.repository.findExperienceVersionByGenerationId(
        payload.metadata.generationId,
      );

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
    runId: string;
    operation: 'generate' | 'refine';
    prompt: string;
    format?: GenerateExperienceToolArguments['format'];
    audience?: GenerateExperienceToolArguments['audience'];
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

    const decision = await this.decisionRouter.decideRoute({
      requestId: input.runId,
      operation: input.operation,
      prompt: input.prompt,
      format: input.format,
      audience: input.audience,
      conversationContext: input.conversationContext,
      refinementInstruction: input.refinementInstruction,
      hasPriorExperience: input.hasPriorExperience,
    });

    await this.repository.recordRunRoutingDecision({
      runId: input.runId,
      tier: decision.tier,
      confidence: decision.confidence,
      reason: decision.reason,
      fallbackReason: decision.fallbackReason,
      selectedProvider: decision.selectedProvider,
      selectedModel: decision.selectedModel,
    });

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
