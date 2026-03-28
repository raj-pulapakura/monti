import { Injectable } from '@nestjs/common';
import type { ProviderKind } from './llm.types';

const LLM_RUNTIME_CONFIG = {
  router: {
    provider: 'openai',
    model: 'gpt-5-mini',
    maxTokens: 1024,
  },
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
  maxTokensDefault: 32_768,
  maxTokensRetry: 32_768,
  timeoutMs: 300_000,
  maxPartChars: 60_000,
  conversation: {
    provider: 'openai',
    model: 'gpt-5.4',
    maxTokens: 4_096,
    maxToolRounds: 4,
    systemPrompt:
      'You are Monti, a helpful assistant for learning experiences. Use tools only when needed. For generate_experience: use operation=generate for new requests; use operation=refine only when priorGenerationId, refinementInstruction, and full priorExperience (title, description, html, css, js) are available. If a tool succeeds or fails, acknowledge the result clearly and continue helping the user.',
  },
} as const satisfies {
  router: {
    provider: ProviderKind;
    model: string;
    maxTokens: number;
  };
  routeByQuality: Record<'fast' | 'quality', ProviderKind>;
  modelsByProvider: Record<ProviderKind, { fast: string; quality: string }>;
  maxTokensDefault: number;
  maxTokensRetry: number;
  timeoutMs: number;
  maxPartChars: number;
  conversation: {
    provider: ProviderKind;
    model: string;
    maxTokens: number;
    maxToolRounds: number;
    systemPrompt: string;
  };
};

@Injectable()
export class LlmConfigService {
  readonly routerProvider = readProvider(
    process.env.LLM_ROUTER_PROVIDER,
    LLM_RUNTIME_CONFIG.router.provider,
  );
  readonly routerModel = readString(
    process.env.LLM_ROUTER_MODEL,
    LLM_RUNTIME_CONFIG.router.model,
  );
  readonly routerMaxTokens = readPositiveInt(
    process.env.LLM_ROUTER_MAX_TOKENS,
    LLM_RUNTIME_CONFIG.router.maxTokens,
  );
  readonly maxTokensDefault = readPositiveInt(
    process.env.LLM_MAX_TOKENS_DEFAULT,
    LLM_RUNTIME_CONFIG.maxTokensDefault,
  );
  readonly maxTokensRetry = readPositiveInt(
    process.env.LLM_MAX_TOKENS_RETRY,
    LLM_RUNTIME_CONFIG.maxTokensRetry,
  );
  readonly timeoutMs = LLM_RUNTIME_CONFIG.timeoutMs;
  readonly maxPartChars = LLM_RUNTIME_CONFIG.maxPartChars;

  readonly conversationProvider = readProvider(
    process.env.CONVERSATION_PROVIDER,
    LLM_RUNTIME_CONFIG.conversation.provider,
  );
  readonly conversationModel = readString(
    process.env.CONVERSATION_MODEL,
    LLM_RUNTIME_CONFIG.conversation.model,
  );
  readonly conversationMaxTokens = readPositiveInt(
    process.env.CONVERSATION_MAX_TOKENS,
    LLM_RUNTIME_CONFIG.conversation.maxTokens,
  );
  readonly conversationMaxToolRounds = readPositiveInt(
    process.env.CONVERSATION_MAX_TOOL_ROUNDS,
    LLM_RUNTIME_CONFIG.conversation.maxToolRounds,
  );
  readonly conversationSystemPrompt = readString(
    process.env.CONVERSATION_SYSTEM_PROMPT,
    LLM_RUNTIME_CONFIG.conversation.systemPrompt,
  );

  providerFor(qualityMode: 'fast' | 'quality'): ProviderKind {
    return LLM_RUNTIME_CONFIG.routeByQuality[qualityMode];
  }

  modelFor(provider: ProviderKind, qualityMode: 'fast' | 'quality'): string {
    return LLM_RUNTIME_CONFIG.modelsByProvider[provider][qualityMode];
  }

  resolveExecutionRoute(input: {
    tier: 'fast' | 'quality';
  }): {
    qualityMode: 'fast' | 'quality';
    provider: ProviderKind;
    model: string;
  } {
    const provider = this.providerFor(input.tier);

    return {
      qualityMode: input.tier,
      provider,
      model: this.modelFor(provider, input.tier),
    };
  }
}

function readString(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function readProvider(value: string | undefined, fallback: ProviderKind): ProviderKind {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'openai' || trimmed === 'anthropic' || trimmed === 'gemini') {
    return trimmed;
  }

  return fallback;
}
