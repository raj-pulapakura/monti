import type { LlmUsageTelemetry } from './llm-usage';

export type QualityMode = 'fast' | 'quality';
export type GenerationMode = 'auto' | QualityMode;
export type ProviderKind = 'openai' | 'anthropic' | 'gemini';

export interface LlmGenerateRequest {
  requestId?: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens: number;
  qualityMode: QualityMode;
  model: string;
  signal?: AbortSignal;
  /** Override the JSON response schema enforced by the provider. Defaults to the webpage output schema when omitted. */
  responseSchema?: Record<string, unknown>;
}

export interface LlmProviderResult {
  provider: ProviderKind;
  model: string;
  rawText: string;
  usage: LlmUsageTelemetry;
}

export interface LlmProvider {
  readonly name: ProviderKind;
  generate(request: LlmGenerateRequest): Promise<LlmProviderResult>;
}
