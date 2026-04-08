import type {
  AudienceLevel,
  ExperienceFormat,
  GeneratedExperiencePayload,
} from '../../experience/dto/experience.dto';
import type { ProviderKind } from '../../llm/llm.types';
import { ValidationError } from '../../common/errors/app-error';

export type GenerateExperienceToolOperation = 'generate' | 'refine';

export interface GenerateExperienceToolArguments {
  operation: GenerateExperienceToolOperation;
  prompt: string;
  conversationContext?: string;
  format?: ExperienceFormat;
  audience?: AudienceLevel;
  refinementInstruction?: string;
  priorGenerationId?: string;
  priorExperience?: GeneratedExperiencePayload;
}

export interface GenerateExperienceToolRoute {
  tier: 'fast' | 'quality';
  confidence: number;
  reason: string;
  fallbackReason: string | null;
  selectedProvider: ProviderKind;
  selectedModel: string;
}

export interface GenerateExperienceToolResult {
  status: 'succeeded' | 'failed';
  generationId: string | null;
  experienceId: string | null;
  experienceVersionId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  sandboxStatus: 'creating' | 'ready' | 'error' | 'empty';
  route: GenerateExperienceToolRoute | null;
}

export function parseGenerateExperienceToolArguments(
  input: Record<string, unknown>,
): GenerateExperienceToolArguments {
  const operation =
    input.operation === 'refine'
      ? 'refine'
      : input.operation === 'generate'
        ? 'generate'
        : 'generate';
  const prompt = asRequiredString(input.prompt, 'prompt');
  const format = asOptionalEnum(
    input.format,
    ['quiz', 'game', 'explainer'] as const,
    'format',
  );
  const audience = asOptionalEnum(
    input.audience,
    [
      'young-kids',
      'elementary',
      'middle-school',
      'high-school',
      'university',
      'adult',
    ] as const,
    'audience',
  );
  if (operation === 'generate') {
    return {
      operation,
      prompt,
      format,
      audience,
    };
  }

  const refinementInstruction = asRequiredString(
    input.refinementInstruction,
    'refinementInstruction',
  );

  // Refine uses the thread sandbox as the source of truth for prior HTML/CSS/JS
  // and generation id (see GenerateExperienceToolService.execute). The model
  // typically cannot supply priorExperience/priorGenerationId (tool results are
  // not re-fed into the LLM), so these stay optional.
  const out: GenerateExperienceToolArguments = {
    operation,
    prompt,
    format,
    audience,
    refinementInstruction,
  };

  if (input.priorGenerationId !== undefined && input.priorGenerationId !== null) {
    out.priorGenerationId = asRequiredString(
      input.priorGenerationId,
      'priorGenerationId',
    );
  }

  if (input.priorExperience !== undefined && input.priorExperience !== null) {
    out.priorExperience = parsePriorExperience(input.priorExperience);
  }

  return out;
}

function parsePriorExperience(value: unknown): GeneratedExperiencePayload {
  if (value === undefined || value === null) {
    throw new ValidationError('priorExperience must be an object when provided.');
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('priorExperience must be an object.');
  }

  const object = value as Record<string, unknown>;

  return {
    title: asRequiredString(object.title, 'priorExperience.title'),
    description: asRequiredString(
      object.description,
      'priorExperience.description',
    ),
    html: asRequiredString(object.html, 'priorExperience.html'),
    css: asRequiredString(object.css, 'priorExperience.css'),
    js: asRequiredString(object.js, 'priorExperience.js'),
  };
}

function asRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
  }

  return trimmed;
}

function asOptionalEnum<T extends readonly string[]>(
  value: unknown,
  options: T,
  fieldName: string,
): T[number] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string' || !options.includes(value)) {
    throw new ValidationError(`${fieldName} must be one of: ${options.join(', ')}.`);
  }

  return value as T[number];
}
