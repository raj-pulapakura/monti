import { Injectable } from '@nestjs/common';
import type { ProviderKind } from './llm.types';

const LLM_RUNTIME_CONFIG = {
  routeByQuality: {
    fast: 'gemini',
    quality: 'gemini',
  },
  modelsByProvider: {
    openai: {
      fast: 'gpt-5-mini',
      quality: 'gpt-5.4',
    },
    anthropic: {
      fast: 'claude-3-5-sonnet-latest',
      quality: 'claude-3-5-sonnet-latest',
    },
    gemini: {
      fast: 'gemini-3.1-flash-lite-preview',
      quality: 'gemini-3.1-pro-preview',
    },
  },
  maxTokensDefault: 8_192,
  maxTokensRetry: 16_384,
  timeoutMs: 300_000,
  maxPartChars: 60_000,
} as const satisfies {
  routeByQuality: Record<'fast' | 'quality', ProviderKind>;
  modelsByProvider: Record<ProviderKind, { fast: string; quality: string }>;
  maxTokensDefault: number;
  maxTokensRetry: number;
  timeoutMs: number;
  maxPartChars: number;
};

@Injectable()
export class LlmConfigService {
  readonly maxTokensDefault = LLM_RUNTIME_CONFIG.maxTokensDefault;
  readonly maxTokensRetry = LLM_RUNTIME_CONFIG.maxTokensRetry;
  readonly timeoutMs = LLM_RUNTIME_CONFIG.timeoutMs;
  readonly maxPartChars = LLM_RUNTIME_CONFIG.maxPartChars;

  providerFor(qualityMode: 'fast' | 'quality'): ProviderKind {
    return LLM_RUNTIME_CONFIG.routeByQuality[qualityMode];
  }

  modelFor(provider: ProviderKind, qualityMode: 'fast' | 'quality'): string {
    return LLM_RUNTIME_CONFIG.modelsByProvider[provider][qualityMode];
  }
}
