import { Injectable, Logger } from '@nestjs/common';
import {
  ProviderMaxTokensError,
  ProviderRefusalError,
  ProviderResponseError,
  ProviderUnavailableError,
} from '../../common/errors/app-error';
import { logEvent } from '../../common/logging/log-event';
import { normalizeGeminiUsage } from '../provider-usage';
import type { LlmGenerateRequest, LlmProvider, LlmProviderResult } from '../llm.types';

const WEBPAGE_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['title', 'description', 'html', 'css', 'js'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    html: { type: 'string' },
    css: { type: 'string' },
    js: { type: 'string' },
  },
} as const;

interface GeminiResponse {
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  promptFeedback?: {
    blockReason?: string;
  };
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  readonly name = 'gemini' as const;
  private readonly logger = new Logger(GeminiLlmProvider.name);

  async generate(request: LlmGenerateRequest): Promise<LlmProviderResult> {
    const apiKey = process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderUnavailableError(
        'GOOGLE_API_KEY is not configured (legacy fallback: GEMINI_API_KEY).',
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(request.system
          ? {
              systemInstruction: {
                role: 'system',
                parts: [{ text: request.system }],
              },
            }
          : {}),
        contents: [
          {
            role: 'user',
            parts: [{ text: request.prompt }],
          },
        ],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          responseMimeType: 'application/json',
          responseSchema: request.responseSchema ?? WEBPAGE_OUTPUT_SCHEMA,
        },
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'Unknown provider error');
      this.logger.warn(
        logEvent('provider_gemini_http_error', {
          requestId: request.requestId ?? null,
          model: request.model,
          status: response.status,
        }),
      );
      throw new ProviderResponseError(`Gemini request failed: ${detail}`);
    }

    const payload = (await response.json()) as GeminiResponse;
    const usage = normalizeGeminiUsage(payload.usageMetadata);

    const blockReason = payload.promptFeedback?.blockReason;
    if (typeof blockReason === 'string' && blockReason.length > 0) {
      this.logger.warn(
        logEvent('provider_gemini_refusal', {
          requestId: request.requestId ?? null,
          model: request.model,
          blockReason,
        }),
      );
      throw new ProviderRefusalError(
        `Gemini blocked this generation request: ${blockReason}.`,
        {
          usage,
        },
      );
    }

    const finishReason = payload.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      this.logger.warn(
        logEvent('provider_gemini_max_tokens', {
          requestId: request.requestId ?? null,
          model: request.model,
          maxTokens: request.maxTokens,
        }),
      );
      throw new ProviderMaxTokensError(
        `Gemini hit maxOutputTokens (${request.maxTokens}) before completion.`,
        {
          usage,
        },
      );
    }

    if (typeof finishReason === 'string' && finishReason.length > 0 && finishReason !== 'STOP') {
      throw new ProviderResponseError(
        `Gemini did not complete generation (finishReason: ${finishReason}).`,
        {
          usage,
        },
      );
    }

    const rawText =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim() ?? '';

    if (!rawText) {
      throw new ProviderResponseError('Gemini returned empty structured output.', {
        usage,
      });
    }

    return {
      provider: this.name,
      model: request.model,
      rawText,
      usage,
    };
  }
}
