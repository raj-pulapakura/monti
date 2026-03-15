import { Injectable, Logger } from '@nestjs/common';
import {
  ProviderResponseError,
  ProviderUnavailableError,
} from '../common/errors/app-error';
import { LlmConfigService } from './llm-config.service';
import type { ProviderKind } from './llm.types';

interface RouterResponsePayload {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

interface RawRoutingDecision {
  tier?: unknown;
  confidence?: unknown;
  reason?: unknown;
}

export interface LlmRoutingDecision {
  tier: 'fast' | 'quality';
  confidence: number;
  reason: string;
  fallbackReason: string | null;
  selectedProvider: ProviderKind;
  selectedModel: string;
}

@Injectable()
export class LlmDecisionRouterService {
  private readonly logger = new Logger(LlmDecisionRouterService.name);

  constructor(private readonly config: LlmConfigService) {}

  async decideRoute(input: {
    requestId?: string;
    prompt: string;
  }): Promise<LlmRoutingDecision> {
    if (!isRouterStageEnabled()) {
      const fallback = this.config.resolveExecutionRoute({
        tier: 'fast',
      });

      return {
        tier: 'fast',
        confidence: 0,
        reason: 'Router stage disabled by feature flag.',
        fallbackReason: 'ROUTER_STAGE_DISABLED',
        selectedProvider: fallback.provider,
        selectedModel: fallback.model,
      };
    }

    try {
      const raw = await this.invokeRouterModel(input);
      const parsed = parseRoutingDecision(raw);
      const resolved = this.config.resolveExecutionRoute({
        tier: parsed.tier,
      });

      return {
        tier: parsed.tier,
        confidence: parsed.confidence,
        reason: parsed.reason,
        fallbackReason: null,
        selectedProvider: resolved.provider,
        selectedModel: resolved.model,
      };
    } catch (error) {
      const fallback = this.config.resolveExecutionRoute({
        tier: 'fast',
      });
      const fallbackReason = error instanceof Error ? error.message : 'Router invocation failed.';

      this.logger.warn(
        JSON.stringify({
          event: 'llm_routing_fallback',
          requestId: input.requestId ?? null,
          fallbackProvider: fallback.provider,
          fallbackModel: fallback.model,
          fallbackReason,
        }),
      );

      return {
        tier: 'fast',
        confidence: 0,
        reason: 'Fallback routing policy applied.',
        fallbackReason,
        selectedProvider: fallback.provider,
        selectedModel: fallback.model,
      };
    }
  }

  private async invokeRouterModel(input: {
    requestId?: string;
    prompt: string;
  }): Promise<RawRoutingDecision> {
    if (this.config.routerProvider !== 'openai') {
      throw new ProviderResponseError(
        `Router provider ${this.config.routerProvider} is not implemented yet.`,
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderUnavailableError('OPENAI_API_KEY is not configured for router calls.');
    }

    const body = {
      model: this.config.routerModel,
      max_output_tokens: this.config.routerMaxTokens,
      reasoning: {
        effort: 'minimal',
      },
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                'You route requests between fast and quality tiers. Return strict JSON with tier, confidence, reason.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Prompt: ${input.prompt}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'monti_router_decision',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['tier', 'confidence', 'reason'],
            properties: {
              tier: {
                type: 'string',
                enum: ['fast', 'quality'],
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
              },
              reason: {
                type: 'string',
                minLength: 1,
                maxLength: 200,
              },
            },
          },
        },
      },
    };

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'Unknown provider error');
      throw new ProviderResponseError(`Router model request failed: ${detail}`);
    }

    const payload = (await response.json()) as RouterResponsePayload;
    const text = extractResponseText(payload);
    if (!text) {
      throw new ProviderResponseError('Router model returned empty output.');
    }

    return parseRouterDecisionText(text);
  }
}

function parseRoutingDecision(value: RawRoutingDecision): {
  tier: 'fast' | 'quality';
  confidence: number;
  reason: string;
} {
  if (value.tier !== 'fast' && value.tier !== 'quality') {
    throw new ProviderResponseError('Router response missing valid tier.');
  }

  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)) {
    throw new ProviderResponseError('Router response missing valid confidence.');
  }

  const confidence = Math.max(0, Math.min(1, value.confidence));

  if (typeof value.reason !== 'string' || value.reason.trim().length === 0) {
    throw new ProviderResponseError('Router response missing valid reason.');
  }

  return {
    tier: value.tier,
    confidence,
    reason: value.reason.trim(),
  };
}

function extractResponseText(payload: RouterResponsePayload): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload.output)) {
    return '';
  }

  return payload.output
    .filter((message) => message.type === 'message' && Array.isArray(message.content))
    .flatMap((message) => message.content as Array<{ type?: string; text?: string }>)
    .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('')
    .trim();
}

function parseRouterDecisionText(text: string): RawRoutingDecision {
  const primary = text.trim();
  if (primary.length === 0) {
    throw new ProviderResponseError('Router model returned empty output.');
  }

  try {
    return JSON.parse(primary) as RawRoutingDecision;
  } catch {
    const candidate = extractJsonObject(primary);
    if (!candidate) {
      throw new ProviderResponseError('Router model output was not valid JSON.');
    }

    try {
      return JSON.parse(candidate) as RawRoutingDecision;
    } catch {
      throw new ProviderResponseError('Router model output was not valid JSON.');
    }
  }
}

function extractJsonObject(text: string): string | null {
  const withoutFence = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return withoutFence.slice(start, end + 1);
}

function isRouterStageEnabled(): boolean {
  const flag = process.env.ROUTER_STAGE_ENABLED?.trim().toLowerCase();
  return !(flag === 'false' || flag === '0' || flag === 'off');
}
