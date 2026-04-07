import { Injectable, Logger } from '@nestjs/common';
import {
  AppError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from '../common/errors/app-error';
import { logEvent } from '../common/logging/log-event';
import { LlmConfigService } from './llm-config.service';
import type { LlmProvider, LlmProviderResult, ProviderKind, QualityMode } from './llm.types';
import { AnthropicLlmProvider } from './providers/anthropic-llm.provider';
import { GeminiLlmProvider } from './providers/gemini-llm.provider';
import { OpenAiLlmProvider } from './providers/openai-llm.provider';

export interface RoutedGenerationRequest {
  requestId?: string;
  prompt: string;
  system?: string;
  temperature?: number;
  qualityMode: QualityMode;
  maxTokens: number;
  provider?: ProviderKind;
  responseSchema?: Record<string, unknown>;
}

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);
  private readonly providers: Map<ProviderKind, LlmProvider>;

  constructor(
    private readonly config: LlmConfigService,
    openAiProvider: OpenAiLlmProvider,
    anthropicProvider: AnthropicLlmProvider,
    geminiProvider: GeminiLlmProvider,
  ) {
    this.providers = new Map<ProviderKind, LlmProvider>([
      ['openai', openAiProvider],
      ['anthropic', anthropicProvider],
      ['gemini', geminiProvider],
    ]);
  }

  async generateStructured(request: RoutedGenerationRequest): Promise<LlmProviderResult> {
    const providerName = request.provider ?? this.config.providerFor(request.qualityMode);
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new ProviderUnavailableError(`Unsupported provider: ${providerName}`);
    }

    const model = this.config.modelFor(providerName, request.qualityMode);
    const startedAt = Date.now();

    this.logger.log(
      logEvent('llm_route_selected', {
        requestId: request.requestId ?? null,
        provider: providerName,
        model,
        qualityMode: request.qualityMode,
        providerOverridden: request.provider !== undefined,
        maxTokens: request.maxTokens,
        temperature: request.temperature ?? null,
        promptChars: request.prompt.length,
        systemChars: request.system?.length ?? 0,
      }),
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const result = await provider.generate({
        requestId: request.requestId,
        prompt: request.prompt,
        system: request.system,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        qualityMode: request.qualityMode,
        model,
        signal: controller.signal,
        responseSchema: request.responseSchema,
      });

      this.logger.log(
        logEvent('llm_route_completed', {
          requestId: request.requestId ?? null,
          provider: result.provider,
          model: result.model,
          qualityMode: request.qualityMode,
          durationMs: Date.now() - startedAt,
          rawTextChars: result.rawText.length,
        }),
      );

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn(
          logEvent('llm_route_timeout', {
            requestId: request.requestId ?? null,
            provider: providerName,
            model,
            qualityMode: request.qualityMode,
            timeoutMs: this.config.timeoutMs,
            durationMs: Date.now() - startedAt,
          }),
        );
        throw new ProviderTimeoutError(
          `Provider timed out after ${this.config.timeoutMs}ms. Try again with a shorter prompt.`,
        );
      }

      this.logger.error(
        logEvent('llm_route_failed', {
          requestId: request.requestId ?? null,
          provider: providerName,
          model,
          qualityMode: request.qualityMode,
          durationMs: Date.now() - startedAt,
          ...this.getErrorDetails(error),
        }),
      );

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private getErrorDetails(error: unknown): {
    errorType: string;
    errorMessage: string;
    errorCode?: string;
    statusCode?: number;
  } {
    if (error instanceof AppError) {
      return {
        errorType: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        statusCode: error.statusCode,
      };
    }

    if (error instanceof Error) {
      return {
        errorType: error.name,
        errorMessage: error.message,
      };
    }

    return {
      errorType: 'UnknownError',
      errorMessage: 'Unknown error',
    };
  }
}
