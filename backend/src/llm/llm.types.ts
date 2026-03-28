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
}

export interface LlmProviderResult {
  provider: ProviderKind;
  model: string;
  rawText: string;
}

export interface LlmProvider {
  readonly name: ProviderKind;
  generate(request: LlmGenerateRequest): Promise<LlmProviderResult>;
}
