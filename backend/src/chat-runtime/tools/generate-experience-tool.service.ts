import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { ExperienceOrchestratorService } from '../../experience/services/experience-orchestrator.service';
import { LlmDecisionRouterService } from '../../llm/llm-decision-router.service';
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
    private readonly orchestrator: ExperienceOrchestratorService,
    private readonly repository: ChatRuntimeRepository,
  ) {}

  async execute(input: {
    runId: string;
    threadId: string;
    userId: string;
    arguments: GenerateExperienceToolArguments;
  }): Promise<GenerateExperienceToolResult> {
    const routingPrompt = withConversationContext(
      input.arguments.prompt,
      input.arguments.conversationContext,
    );

    const route = await this.selectRoute({
      runId: input.runId,
      prompt: routingPrompt,
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
    prompt: string;
  }): Promise<GenerateExperienceToolRoute> {
    const decision = await this.decisionRouter.decideRoute({
      requestId: input.runId,
      prompt: input.prompt,
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
