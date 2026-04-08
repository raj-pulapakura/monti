import { ValidationError } from '../../common/errors/app-error';
import type { ProviderKind, QualityMode } from '../../llm/llm.types';

export interface GeneratedExperiencePayload {
  title: string;
  description: string;
  html: string;
  css: string;
  js: string;
}

export interface GenerateExperienceRequest {
  userId: string;
  prompt: string;
  qualityMode: QualityMode;
  provider?: ProviderKind;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface RefineExperienceRequest {
  userId: string;
  originalPrompt: string;
  priorGenerationId: string;
  refinementInstruction: string;
  priorExperience: GeneratedExperiencePayload;
  qualityMode: QualityMode;
  provider?: ProviderKind;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ExperienceResponseMetadata {
  generationId: string;
  provider: ProviderKind;
  model: string;
  qualityMode: QualityMode;
  maxTokens: number;
  renderingContract: {
    iframeOnly: true;
    sandbox: 'allow-scripts';
    networkAccess: 'disallowed';
    externalLibraries: 'disallowed';
  };
}

export interface ExperienceResponsePayload {
  experience: GeneratedExperiencePayload;
  metadata: ExperienceResponseMetadata;
}

interface ParseSharedOptions {
  userId: string;
  qualityMode: QualityMode;
  provider?: ProviderKind;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export function parseRefineExperienceRequest(body: unknown): RefineExperienceRequest {
  const object = asRecord(body, 'Request body must be a JSON object.');

  const originalPrompt = asRequiredString(object.originalPrompt, 'originalPrompt');
  const priorGenerationId = asRequiredString(
    object.priorGenerationId,
    'priorGenerationId',
  );
  const refinementInstruction = asRequiredString(
    object.refinementInstruction,
    'refinementInstruction',
  );

  const priorExperienceCandidate = asRecord(
    object.priorExperience,
    'priorExperience must be an object with title, description, html, css, js.',
  );

  const priorExperience: GeneratedExperiencePayload = {
    title: asRequiredString(priorExperienceCandidate.title, 'priorExperience.title'),
    description: asRequiredString(
      priorExperienceCandidate.description,
      'priorExperience.description',
    ),
    html: asRequiredString(priorExperienceCandidate.html, 'priorExperience.html'),
    css: asRequiredString(priorExperienceCandidate.css, 'priorExperience.css'),
    js: asRequiredString(priorExperienceCandidate.js, 'priorExperience.js'),
  };

  const shared = parseSharedOptions(object);

  return {
    originalPrompt,
    priorGenerationId,
    refinementInstruction,
    priorExperience,
    ...shared,
  };
}

function parseSharedOptions(object: Record<string, unknown>): ParseSharedOptions {
  return {
    userId: asRequiredString(object.userId, 'userId'),
    qualityMode:
      object.qualityMode === undefined
        ? 'fast'
        : asOneOf(object.qualityMode, ['fast', 'quality'] as const, 'qualityMode'),
    provider:
      object.provider === undefined
        ? undefined
        : asOneOf(object.provider, ['openai', 'anthropic', 'gemini'] as const, 'provider'),
    system:
      object.system === undefined ? undefined : asRequiredString(object.system, 'system', true),
    temperature:
      object.temperature === undefined
        ? undefined
        : asFiniteNumber(object.temperature, 'temperature'),
    maxTokens:
      object.maxTokens === undefined
        ? undefined
        : asPositiveInt(object.maxTokens, 'maxTokens'),
  };
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(message);
  }

  return value as Record<string, unknown>;
}

function asRequiredString(value: unknown, fieldName: string, allowEmpty = false): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
  }

  return trimmed;
}

function asFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a finite number.`);
  }

  return value;
}

function asPositiveInt(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer.`);
  }

  return value;
}

function asOneOf<T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
  fieldName: string,
): T[number] {
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}.`);
  }

  return value as T[number];
}
