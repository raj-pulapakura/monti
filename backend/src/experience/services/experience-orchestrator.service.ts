import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { AppError, ProviderMaxTokensError, ProviderResponseError } from '../../common/errors/app-error';
import {
  logEvent,
} from '../../common/logging/log-event';
import { LlmConfigService } from '../../llm/llm-config.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import type { ProviderKind } from '../../llm/llm.types';
import { SafetyGuardService } from '../../safety/safety-guard.service';
import { PayloadValidationService } from '../../validation/payload-validation.service';
import type {
  ExperienceResponsePayload,
  GenerateExperienceRequest,
  RefineExperienceRequest,
} from '../dto/experience.dto';
import { PromptBuilderService } from './prompt-builder.service';

@Injectable()
export class ExperienceOrchestratorService {
  private readonly logger = new Logger(ExperienceOrchestratorService.name);

  constructor(
    private readonly llmConfig: LlmConfigService,
    private readonly llmRouter: LlmRouterService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly payloadValidation: PayloadValidationService,
    private readonly safetyGuard: SafetyGuardService,
  ) {}

  async generate(request: GenerateExperienceRequest): Promise<ExperienceResponsePayload> {
    const requestId = randomUUID();
    const prompt = this.promptBuilder.buildGenerationPrompt(request);
    return this.executeGeneration({
      requestId,
      operation: 'generate',
      prompt,
      qualityMode: request.qualityMode,
      provider: request.provider,
      system: request.system,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
  }

  async refine(request: RefineExperienceRequest): Promise<ExperienceResponsePayload> {
    const requestId = randomUUID();
    const prompt = this.promptBuilder.buildRefinementPrompt(request);
    return this.executeGeneration({
      requestId,
      operation: 'refine',
      prompt,
      qualityMode: request.qualityMode,
      provider: request.provider,
      system: request.system,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
  }

  private async executeGeneration(input: {
    requestId: string;
    operation: 'generate' | 'refine';
    prompt: string;
    qualityMode: 'fast' | 'quality';
    provider?: ProviderKind;
    system?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ExperienceResponsePayload> {
    const startedAt = Date.now();
    let maxTokens = input.maxTokens ?? this.llmConfig.maxTokensDefault;
    const userDefinedMaxTokens = typeof input.maxTokens === 'number';

    this.logger.log(
      logEvent('ui_generation_started', {
        requestId: input.requestId,
        operation: input.operation,
        qualityMode: input.qualityMode,
        providerOverride: input.provider ?? null,
        promptChars: input.prompt.length,
        promptHash: this.hashPrompt(input.prompt),
        hasSystemPrompt: Boolean(input.system && input.system.trim().length > 0),
        temperature: input.temperature ?? null,
        maxTokensInitial: maxTokens,
        userDefinedMaxTokens,
      }),
    );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const attemptNumber = attempt + 1;
        this.logger.log(
          logEvent('ui_generation_attempt_started', {
            requestId: input.requestId,
            operation: input.operation,
            attempt: attemptNumber,
            maxTokens,
          }),
        );

        const llmResult = await this.llmRouter.generateStructured({
          requestId: input.requestId,
          prompt: input.prompt,
          qualityMode: input.qualityMode,
          provider: input.provider,
          system: input.system,
          temperature: input.temperature,
          maxTokens,
        });

        this.logger.log(
          logEvent('ui_generation_llm_output_received', {
            requestId: input.requestId,
            operation: input.operation,
            attempt: attemptNumber,
            provider: llmResult.provider,
            model: llmResult.model,
            rawTextChars: llmResult.rawText.length,
          }),
        );

        const experience = this.payloadValidation.parseAndValidate(llmResult.rawText);
        this.safetyGuard.assertSafe(experience);

        this.logger.log(
          logEvent('ui_generation_completed', {
            requestId: input.requestId,
            operation: input.operation,
            attempt: attemptNumber,
            provider: llmResult.provider,
            model: llmResult.model,
            qualityMode: input.qualityMode,
            durationMs: Date.now() - startedAt,
            maxTokensFinal: maxTokens,
            outputChars: {
              title: experience.title.length,
              description: experience.description.length,
              html: experience.html.length,
              css: experience.css.length,
              js: experience.js.length,
            },
          }),
        );

        return {
          experience,
          metadata: {
            generationId: input.requestId,
            provider: llmResult.provider,
            model: llmResult.model,
            qualityMode: input.qualityMode,
            maxTokens,
            renderingContract: {
              iframeOnly: true,
              sandbox: 'allow-scripts',
              networkAccess: 'disallowed',
              externalLibraries: 'disallowed',
            },
          },
        };
      } catch (error) {
        if (
          error instanceof ProviderMaxTokensError &&
          !userDefinedMaxTokens &&
          attempt === 0
        ) {
          const retryTokens = Math.min(maxTokens * 2, this.llmConfig.maxTokensRetry);
          if (retryTokens <= maxTokens) {
            throw new ProviderResponseError(
              `Generation was truncated at token limit (${maxTokens}).`,
            );
          }

          this.logger.warn(
            logEvent('ui_generation_retrying_after_max_tokens', {
              requestId: input.requestId,
              operation: input.operation,
              attempt: attempt + 1,
              previousMaxTokens: maxTokens,
              nextMaxTokens: retryTokens,
            }),
          );

          maxTokens = retryTokens;
          continue;
        }

        this.logger.error(
          logEvent('ui_generation_failed', {
            requestId: input.requestId,
            operation: input.operation,
            attempt: attempt + 1,
            qualityMode: input.qualityMode,
            durationMs: Date.now() - startedAt,
            ...this.getErrorDetails(error),
          }),
        );

        throw error;
      }
    }

    throw new ProviderResponseError('Failed to generate experience.');
  }

  private hashPrompt(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex').slice(0, 16);
  }

  private getErrorDetails(error: unknown): {
    errorType: string;
    errorMessage: string;
    errorCode?: string;
    statusCode?: number;
  } {
    if (error instanceof AppError) {
      return {
        errorType: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        statusCode: error.statusCode,
      };
    }

    if (error instanceof Error) {
      return {
        errorType: error.name,
        errorMessage: error.message,
      };
    }

    return {
      errorType: 'UnknownError',
      errorMessage: 'Unknown error',
    };
  }
}
