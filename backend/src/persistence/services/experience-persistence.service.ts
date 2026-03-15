import { Injectable } from '@nestjs/common';
import { ValidationError } from '../../common/errors/app-error';
import type {
  AudienceLevel,
  ExperienceFormat,
  GeneratedExperiencePayload,
} from '../../experience/dto/experience.dto';
import type { ProviderKind, QualityMode } from '../../llm/llm.types';
import { ExperiencePersistenceRepository } from './experience-persistence.repository';

interface PersistSuccessInput {
  requestId: string;
  operation: 'generate' | 'refine';
  clientId: string;
  prompt: string;
  refinementInstruction?: string;
  parentGenerationId?: string;
  format?: ExperienceFormat;
  audience?: AudienceLevel;
  qualityMode: QualityMode;
  provider: ProviderKind;
  model: string;
  maxTokens: number;
  experience: GeneratedExperiencePayload;
  latencyMs: number;
}

@Injectable()
export class ExperiencePersistenceService {
  constructor(private readonly repository: ExperiencePersistenceRepository) {}

  async recordRunStarted(input: {
    requestId: string;
    clientId: string;
    operation: 'generate' | 'refine';
    qualityMode: QualityMode;
    prompt: string;
  }): Promise<void> {
    await this.repository.createRun({
      requestId: input.requestId,
      clientId: input.clientId,
      operation: input.operation,
      qualityMode: input.qualityMode,
      inputPrompt: input.prompt,
    });
  }

  async recordRunFailed(input: {
    requestId: string;
    provider?: ProviderKind;
    model?: string;
    errorMessage: string;
  }): Promise<void> {
    await this.repository.markRunFailed(input);
  }

  async persistSuccess(input: PersistSuccessInput): Promise<void> {
    const persistenceTarget =
      input.operation === 'generate'
        ? await this.persistGeneration(input)
        : await this.persistRefinement(input);

    await this.repository.markRunSucceeded({
      requestId: input.requestId,
      experienceId: persistenceTarget.experienceId,
      versionId: persistenceTarget.versionId,
      provider: input.provider,
      model: input.model,
      qualityMode: input.qualityMode,
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
      clientId: input.clientId,
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
