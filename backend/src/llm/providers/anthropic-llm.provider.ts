import { Injectable, Logger } from '@nestjs/common';
import {
  ProviderMaxTokensError,
  ProviderRefusalError,
  ProviderResponseError,
  ProviderUnavailableError,
} from '../../common/errors/app-error';
import { logEvent } from '../../common/logging/log-event';
import { normalizeAnthropicUsage } from '../provider-usage';
import type { LlmGenerateRequest, LlmProvider, LlmProviderResult } from '../llm.types';

const WEBPAGE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'html', 'css', 'js'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    html: { type: 'string' },
    css: { type: 'string' },
    js: { type: 'string' },
  },
} as const;

interface AnthropicResponse {
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

@Injectable()
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = 'anthropic' as const;
  private readonly logger = new Logger(AnthropicLlmProvider.name);

  async generate(request: LlmGenerateRequest): Promise<LlmProviderResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderUnavailableError('ANTHROPIC_API_KEY is not configured.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        system: request.system,
        temperature: request.temperature,
        messages: [{ role: 'user', content: request.prompt }],
        output_config: {
          format: {
            type: 'json_schema',
            schema: request.responseSchema ?? WEBPAGE_OUTPUT_SCHEMA,
          },
        },
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'Unknown provider error');
      this.logger.warn(
        logEvent('provider_anthropic_http_error', {
          requestId: request.requestId ?? null,
          model: request.model,
          status: response.status,
        }),
      );
      throw new ProviderResponseError(`Anthropic request failed: ${detail}`);
    }

    const payload = (await response.json()) as AnthropicResponse;
    const usage = normalizeAnthropicUsage(payload.usage);

    if (payload.stop_reason === 'max_tokens') {
      this.logger.warn(
        logEvent('provider_anthropic_max_tokens', {
          requestId: request.requestId ?? null,
          model: request.model,
          maxTokens: request.maxTokens,
        }),
      );
      throw new ProviderMaxTokensError(
        `Anthropic hit max_tokens (${request.maxTokens}) before completion.`,
        {
          usage,
        },
      );
    }

    if (payload.stop_reason === 'refusal') {
      this.logger.warn(
        logEvent('provider_anthropic_refusal', {
          requestId: request.requestId ?? null,
          model: request.model,
        }),
      );
      throw new ProviderRefusalError('Anthropic refused this generation request.', {
        usage,
      });
    }

    const rawText = Array.isArray(payload.content)
      ? payload.content
          .filter((block) => block?.type === 'text' && typeof block.text === 'string')
          .map((block) => block.text as string)
          .join('')
          .trim()
      : '';

    if (!rawText) {
      throw new ProviderResponseError('Anthropic returned empty structured output.', {
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
