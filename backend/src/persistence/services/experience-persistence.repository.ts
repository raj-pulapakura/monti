import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { SUPABASE_CLIENT } from '../../supabase/supabase.constants';
import type { MontiSupabaseClient } from '../../supabase/supabase.types';
import type { AudienceLevel, ExperienceFormat, GeneratedExperiencePayload } from '../../experience/dto/experience.dto';
import type { ProviderKind, QualityMode } from '../../llm/llm.types';

interface CreateVersionInput {
  requestId: string;
  experienceId: string;
  parentGenerationId: string | null;
  versionNumber: number;
  operation: 'generate' | 'refine';
  promptSummary: string;
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
export class ExperiencePersistenceRepository {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly client: MontiSupabaseClient,
  ) {}

  async createRun(input: {
    requestId: string;
    clientId: string;
    operation: 'generate' | 'refine';
    qualityMode: QualityMode;
    inputPrompt: string;
  }): Promise<void> {
    const { error } = await this.client.from('generation_runs').insert({
      request_id: input.requestId,
      client_id: input.clientId,
      operation: input.operation,
      quality_mode: input.qualityMode,
      input_prompt: input.inputPrompt,
      status: 'running',
      started_at: new Date().toISOString(),
    });

    if (error) {
      this.throwQueryError('create generation run', error);
    }
  }

  async markRunSucceeded(input: {
    requestId: string;
    experienceId: string;
    versionId: string;
    provider: ProviderKind;
    model: string;
    qualityMode: QualityMode;
    outputRaw: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.client
      .from('generation_runs')
      .update({
        experience_id: input.experienceId,
        version_id: input.versionId,
        provider: input.provider,
        model: input.model,
        quality_mode: input.qualityMode,
        output_raw: input.outputRaw,
        status: 'succeeded',
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('request_id', input.requestId);

    if (error) {
      this.throwQueryError('mark generation run as succeeded', error);
    }
  }

  async markRunFailed(input: {
    requestId: string;
    provider?: ProviderKind;
    model?: string;
    errorMessage: string;
  }): Promise<void> {
    const { error } = await this.client
      .from('generation_runs')
      .update({
        provider: input.provider ?? null,
        model: input.model ?? null,
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: input.errorMessage,
      })
      .eq('request_id', input.requestId);

    if (error) {
      this.throwQueryError('mark generation run as failed', error);
    }
  }

  async createExperience(input: {
    clientId: string;
    title: string;
  }): Promise<string> {
    const { data, error } = await this.client
      .from('experiences')
      .insert({
        client_id: input.clientId,
        title: input.title,
      })
      .select('id')
      .single();

    if (error) {
      this.throwQueryError('create experience', error);
    }

    return data.id;
  }

  async findVersionByGenerationId(generationId: string): Promise<{
    id: string;
    experienceId: string;
    versionNumber: number;
  } | null> {
    const { data, error } = await this.client
      .from('experience_versions')
      .select('id,experience_id,version_number')
      .eq('generation_id', generationId)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find version by generation id', error);
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      experienceId: data.experience_id,
      versionNumber: data.version_number,
    };
  }

  async createVersion(input: CreateVersionInput): Promise<string> {
    const { data, error } = await this.client
      .from('experience_versions')
      .insert({
        generation_id: input.requestId,
        experience_id: input.experienceId,
        parent_generation_id: input.parentGenerationId,
        version_number: input.versionNumber,
        operation: input.operation,
        prompt_summary: input.promptSummary,
        format: input.format ?? null,
        audience: input.audience ?? null,
        quality_mode: input.qualityMode,
        provider: input.provider,
        model: input.model,
        max_tokens: input.maxTokens,
        title: input.experience.title,
        description: input.experience.description,
        html: input.experience.html,
        css: input.experience.css,
        js: input.experience.js,
        generation_status: 'succeeded',
        latency_ms: input.latencyMs,
      })
      .select('id')
      .single();

    if (error) {
      this.throwQueryError('create experience version', error);
    }

    return data.id;
  }

  private throwQueryError(action: string, error: { message: string; code?: string | null }): never {
    throw new AppError(
      'INTERNAL_ERROR',
      `Failed to ${action}.`,
      500,
      {
        code: error.code ?? undefined,
        message: error.message,
      },
    );
  }
}
