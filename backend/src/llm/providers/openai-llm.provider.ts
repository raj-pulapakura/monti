import { Injectable, Logger } from '@nestjs/common';
import {
  ProviderMaxTokensError,
  ProviderRefusalError,
  ProviderResponseError,
  ProviderUnavailableError,
} from '../../common/errors/app-error';
import { logEvent } from '../../common/logging/log-event';
import { normalizeOpenAiUsage } from '../provider-usage';
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

interface OpenAiResponse {
  status?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  output_text?: string;
  incomplete_details?: {
    reason?: string;
  };
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
}

@Injectable()
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai' as const;
  private readonly logger = new Logger(OpenAiLlmProvider.name);

  async generate(request: LlmGenerateRequest): Promise<LlmProviderResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderUnavailableError('OPENAI_API_KEY is not configured.');
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        temperature: request.temperature,
        max_output_tokens: request.maxTokens,
        input: [
          ...(request.system ? [{ role: 'system', content: request.system }] : []),
          { role: 'user', content: request.prompt },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'monti_experience_payload',
            strict: true,
            schema: WEBPAGE_OUTPUT_SCHEMA,
          },
        },
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'Unknown provider error');
      this.logger.warn(
        logEvent('provider_openai_http_error', {
          requestId: request.requestId ?? null,
          model: request.model,
          status: response.status,
        }),
      );
      throw new ProviderResponseError(`OpenAI request failed: ${detail}`);
    }

    const payload = (await response.json()) as OpenAiResponse;
    const usage = normalizeOpenAiUsage(payload.usage);
    if (
      payload.status === 'incomplete' &&
      payload.incomplete_details?.reason === 'max_output_tokens'
    ) {
      this.logger.warn(
        logEvent('provider_openai_max_tokens', {
          requestId: request.requestId ?? null,
          model: request.model,
          maxTokens: request.maxTokens,
        }),
      );
      throw new ProviderMaxTokensError(
        `OpenAI hit max_output_tokens (${request.maxTokens}) before completion.`,
        {
          usage,
        },
      );
    }

    const refusal = extractRefusal(payload.output);
    if (refusal) {
      this.logger.warn(
        logEvent('provider_openai_refusal', {
          requestId: request.requestId ?? null,
          model: request.model,
        }),
      );
      throw new ProviderRefusalError(`OpenAI refused request: ${refusal}`, {
        usage,
      });
    }

    const rawText = extractText(payload);
    if (!rawText) {
      throw new ProviderResponseError('OpenAI returned empty structured output.', {
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

function extractRefusal(output: OpenAiResponse['output']): string | null {
  if (!Array.isArray(output)) {
    return null;
  }

  for (const message of output) {
    if (message?.type !== 'message' || !Array.isArray(message.content)) {
      continue;
    }

    for (const part of message.content) {
      if (part?.type === 'refusal' && typeof part.refusal === 'string' && part.refusal.length > 0) {
        return part.refusal;
      }
    }
  }

  return null;
}

function extractText(payload: OpenAiResponse): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload.output)) {
    return '';
  }

  return payload.output
    .filter((message) => message?.type === 'message' && Array.isArray(message.content))
    .flatMap((message) => message.content as Array<{ type?: string; text?: string }>)
    .filter((part) => part?.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('')
    .trim();
}
