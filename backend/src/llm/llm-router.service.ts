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
  /** When aborted (e.g. user stopped the chat run), aborts the provider call before route timeout. */
  cancelSignal?: AbortSignal;
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

    const timeoutController = new AbortController();
    const cancelSignal = request.cancelSignal;
    const linked = new AbortController();
    const abortLinked = () => linked.abort();
    const timeoutMs = this.config.timeoutMs;
    const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);

    if (cancelSignal) {
      if (cancelSignal.aborted) {
        abortLinked();
      } else {
        cancelSignal.addEventListener('abort', abortLinked, { once: true });
      }
    }
    timeoutController.signal.addEventListener('abort', abortLinked, { once: true });

    try {
      const result = await provider.generate({
        requestId: request.requestId,
        prompt: request.prompt,
        system: request.system,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        qualityMode: request.qualityMode,
        model,
        signal: linked.signal,
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
        if (cancelSignal?.aborted) {
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        }
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
      cancelSignal?.removeEventListener('abort', abortLinked);
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
