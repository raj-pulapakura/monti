import { Injectable } from '@nestjs/common';
import type { ProviderKind } from '../llm.types';
import { LlmConfigService } from '../llm-config.service';
import type { NativeToolAdapter } from './native-tool-adapter.interface';
import type {
  CanonicalToolTurnRequest,
  CanonicalToolTurnResponse,
  ProviderContinuationState,
} from './tool-runtime.types';
import { AnthropicNativeToolAdapter } from './providers/anthropic-native-tool.adapter';
import { GeminiNativeToolAdapter } from './providers/gemini-native-tool.adapter';
import { OpenAiNativeToolAdapter } from './providers/openai-native-tool.adapter';

export interface RoutedToolTurnRequest {
  requestId?: string;
  provider: ProviderKind;
  qualityMode: 'fast' | 'quality';
  model?: string;
  maxTokens?: number;
  temperature?: number;
  providerContinuation?: ProviderContinuationState;
  messages: CanonicalToolTurnRequest['messages'];
  tools: CanonicalToolTurnRequest['tools'];
  signal?: AbortSignal;
  onAssistantTextSnapshot?: CanonicalToolTurnRequest['onAssistantTextSnapshot'];
}

@Injectable()
export class ToolLlmRouterService {
  private readonly adapters: Map<ProviderKind, NativeToolAdapter>;

  constructor(
    private readonly config: LlmConfigService,
    openAiAdapter: OpenAiNativeToolAdapter,
    anthropicAdapter: AnthropicNativeToolAdapter,
    geminiAdapter: GeminiNativeToolAdapter,
  ) {
    this.adapters = new Map<ProviderKind, NativeToolAdapter>([
      ['openai', openAiAdapter],
      ['anthropic', anthropicAdapter],
      ['gemini', geminiAdapter],
    ]);
  }

  async runTurn(request: RoutedToolTurnRequest): Promise<CanonicalToolTurnResponse> {
    const adapter = this.adapters.get(request.provider);
    if (!adapter) {
      throw new Error(`No native tool adapter configured for provider ${request.provider}.`);
    }

    return adapter.executeTurn({
      requestId: request.requestId,
      provider: request.provider,
      model: request.model ?? this.config.modelFor(request.provider, request.qualityMode),
      maxTokens: request.maxTokens ?? this.config.maxTokensDefault,
      temperature: request.temperature,
      providerContinuation: request.providerContinuation,
      messages: request.messages,
      tools: request.tools,
      signal: request.signal,
      onAssistantTextSnapshot: request.onAssistantTextSnapshot,
    });
  }
}
