import { Injectable } from '@nestjs/common';
import { ValidationError } from '../../common/errors/app-error';
import type {
  AudienceLevel,
  ExperienceFormat,
  ExperienceResponsePayload,
  GeneratedExperiencePayload,
} from '../../experience/dto/experience.dto';
import { ExperienceOrchestratorService } from '../../experience/services/experience-orchestrator.service';
import type { ProviderKind } from '../../llm/llm.types';

export interface GenerateExperienceToolInput {
  operation: 'generate' | 'refine';
  clientId: string;
  prompt: string;
  qualityMode: 'fast' | 'quality';
  provider?: ProviderKind;
  format?: ExperienceFormat;
  audience?: AudienceLevel;
  refinementInstruction?: string;
  priorGenerationId?: string;
  priorExperience?: GeneratedExperiencePayload;
}

export interface ToolExecutionResult {
  toolName: 'generate_experience';
  payload: ExperienceResponsePayload;
}

@Injectable()
export class ChatToolRegistryService {
  constructor(private readonly orchestrator: ExperienceOrchestratorService) {}

  async executeGenerateExperience(input: GenerateExperienceToolInput): Promise<ToolExecutionResult> {
    if (input.operation === 'generate') {
      const payload = await this.orchestrator.generate({
        clientId: input.clientId,
        prompt: input.prompt,
        format: input.format,
        audience: input.audience,
        qualityMode: input.qualityMode,
        provider: input.provider,
      });

      return {
        toolName: 'generate_experience',
        payload,
      };
    }

    if (!input.refinementInstruction) {
      throw new ValidationError('refinementInstruction is required for refine operation.');
    }

    if (!input.priorGenerationId) {
      throw new ValidationError('priorGenerationId is required for refine operation.');
    }

    if (!input.priorExperience) {
      throw new ValidationError('priorExperience is required for refine operation.');
    }

    const payload = await this.orchestrator.refine({
      clientId: input.clientId,
      originalPrompt: input.prompt,
      priorGenerationId: input.priorGenerationId,
      refinementInstruction: input.refinementInstruction,
      priorExperience: input.priorExperience,
      qualityMode: input.qualityMode,
      provider: input.provider,
    });

    return {
      toolName: 'generate_experience',
      payload,
    };
  }
}
