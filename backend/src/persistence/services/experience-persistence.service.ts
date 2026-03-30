import { Injectable } from '@nestjs/common';
import { ValidationError } from '../../common/errors/app-error';
import type {
  AudienceLevel,
  ExperienceFormat,
  GeneratedExperiencePayload,
} from '../../experience/dto/experience.dto';
import type { LlmUsageTelemetry } from '../../llm/llm-usage';
import { toUsageCounts } from '../../llm/llm-usage';
import type { ProviderKind, QualityMode } from '../../llm/llm.types';
import { ExperiencePersistenceRepository } from './experience-persistence.repository';

interface PersistSuccessInput {
  requestId: string;
  operation: 'generate' | 'refine';
  userId: string;
  prompt: string;
  refinementInstruction?: string;
  parentGenerationId?: string;
  format?: ExperienceFormat;
  audience?: AudienceLevel;
  qualityMode: QualityMode;
  provider: ProviderKind;
  model: string;
  maxTokens: number;
  requestUsage: LlmUsageTelemetry;
  successfulAttemptUsage: LlmUsageTelemetry;
  attemptCount: number;
  experience: GeneratedExperiencePayload;
  latencyMs: number;
}

@Injectable()
export class ExperiencePersistenceService {
  constructor(private readonly repository: ExperiencePersistenceRepository) {}

  async recordRunStarted(input: {
    requestId: string;
    userId: string;
    operation: 'generate' | 'refine';
    qualityMode: QualityMode;
    prompt: string;
  }): Promise<void> {
    await this.repository.createRun({
      requestId: input.requestId,
      userId: input.userId,
      operation: input.operation,
      qualityMode: input.qualityMode,
      inputPrompt: input.prompt,
    });
  }

  async recordRunFailed(input: {
    requestId: string;
    provider?: ProviderKind;
    model?: string;
    attemptCount: number;
    requestUsage: LlmUsageTelemetry;
    errorMessage: string;
  }): Promise<void> {
    const requestUsage = toUsageCounts(input.requestUsage);
    await this.repository.markRunFailed({
      requestId: input.requestId,
      provider: input.provider,
      model: input.model,
      attemptCount: input.attemptCount,
      requestTokensIn: requestUsage.tokensIn,
      requestTokensOut: requestUsage.tokensOut,
      errorMessage: input.errorMessage,
    });
  }

  async persistSuccess(input: PersistSuccessInput): Promise<void> {
    const persistenceTarget =
      input.operation === 'generate'
        ? await this.persistGeneration(input)
        : await this.persistRefinement(input);

    const requestUsage = toUsageCounts(input.requestUsage);
    await this.repository.markRunSucceeded({
      requestId: input.requestId,
      experienceId: persistenceTarget.experienceId,
      versionId: persistenceTarget.versionId,
      provider: input.provider,
      model: input.model,
      qualityMode: input.qualityMode,
      attemptCount: input.attemptCount,
      requestTokensIn: requestUsage.tokensIn,
      requestTokensOut: requestUsage.tokensOut,
      outputRaw: {
        title: input.experience.title,
        description: input.experience.description,
        htmlChars: input.experience.html.length,
        cssChars: input.experience.css.length,
        jsChars: input.experience.js.length,
      },
    });
  }

  private async persistGeneration(input: PersistSuccessInput): Promise<{
    experienceId: string;
    versionId: string;
  }> {
    const experienceId = await this.repository.createExperience({
      userId: input.userId,
      title: input.experience.title,
    });

    const versionId = await this.repository.createVersion({
      requestId: input.requestId,
      experienceId,
      parentGenerationId: null,
      versionNumber: 1,
      operation: 'generate',
      promptSummary: summarizePrompt(input.prompt),
      format: input.format,
      audience: input.audience,
      qualityMode: input.qualityMode,
      provider: input.provider,
      model: input.model,
      maxTokens: input.maxTokens,
      tokensIn: toUsageCounts(input.successfulAttemptUsage).tokensIn,
      tokensOut: toUsageCounts(input.successfulAttemptUsage).tokensOut,
      experience: input.experience,
      latencyMs: input.latencyMs,
    });

    return {
      experienceId,
      versionId,
    };
  }

  private async persistRefinement(input: PersistSuccessInput): Promise<{
    experienceId: string;
    versionId: string;
  }> {
    if (!input.parentGenerationId) {
      throw new ValidationError(
        'priorGenerationId is required for refinement persistence.',
      );
    }

    const parentVersion = await this.repository.findVersionByGenerationId(
      input.parentGenerationId,
    );

    if (!parentVersion) {
      throw new ValidationError(
        'priorGenerationId does not match an existing persisted version.',
      );
    }

    const promptSummary = summarizePrompt(
      `${input.prompt}\nRefinement: ${input.refinementInstruction ?? ''}`,
    );

    const versionId = await this.repository.createVersion({
      requestId: input.requestId,
      experienceId: parentVersion.experienceId,
      parentGenerationId: input.parentGenerationId,
      versionNumber: parentVersion.versionNumber + 1,
      operation: 'refine',
      promptSummary,
      format: undefined,
      audience: undefined,
      qualityMode: input.qualityMode,
      provider: input.provider,
      model: input.model,
      maxTokens: input.maxTokens,
      tokensIn: toUsageCounts(input.successfulAttemptUsage).tokensIn,
      tokensOut: toUsageCounts(input.successfulAttemptUsage).tokensOut,
      experience: input.experience,
      latencyMs: input.latencyMs,
    });

    return {
      experienceId: parentVersion.experienceId,
      versionId,
    };
  }
}

function summarizePrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 500) {
    return normalized;
  }

  return `${normalized.slice(0, 497)}...`;
}
