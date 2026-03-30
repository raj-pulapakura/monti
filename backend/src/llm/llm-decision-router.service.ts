import { Injectable, Logger } from '@nestjs/common';
import {
  AppError,
  ProviderResponseError,
  ProviderUnavailableError,
} from '../common/errors/app-error';
import type {
  AudienceLevel,
  ExperienceFormat,
} from '../experience/dto/experience.dto';
import { LlmConfigService } from './llm-config.service';
import { unavailableUsage, type LlmUsageTelemetry } from './llm-usage';
import type { ProviderKind } from './llm.types';
import { normalizeOpenAiUsage } from './provider-usage';

interface RouterResponsePayload {
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
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

interface RouterInvocationResult {
  rawDecision: RawRoutingDecision;
  telemetry: LlmRoutingTelemetry;
}

export interface LlmRoutingDecision {
  tier: 'fast' | 'quality';
  confidence: number;
  reason: string;
  fallbackReason: string | null;
  selectedProvider: ProviderKind;
  selectedModel: string;
}

export interface LlmRoutingTelemetry {
  provider: ProviderKind;
  model: string;
  requestRaw: Record<string, unknown>;
  responseRaw: Record<string, unknown>;
  usage: LlmUsageTelemetry;
}

export interface LlmRoutingResult {
  decision: LlmRoutingDecision;
  telemetry: LlmRoutingTelemetry | null;
}

export interface LlmRoutingRequest {
  requestId?: string;
  operation: 'generate' | 'refine';
  prompt: string;
  format?: ExperienceFormat;
  audience?: AudienceLevel;
  conversationContext?: string;
  refinementInstruction?: string;
  hasPriorExperience?: boolean;
}

@Injectable()
export class LlmDecisionRouterService {
  private readonly logger = new Logger(LlmDecisionRouterService.name);

  constructor(private readonly config: LlmConfigService) {}

  async decideRoute(input: LlmRoutingRequest): Promise<LlmRoutingResult> {
    if (!isRouterStageEnabled()) {
      const fallback = this.config.resolveExecutionRoute({
        tier: 'fast',
      });

      return {
        decision: {
          tier: 'fast',
          confidence: 0,
          reason: 'Router stage disabled by feature flag.',
          fallbackReason: 'ROUTER_STAGE_DISABLED',
          selectedProvider: fallback.provider,
          selectedModel: fallback.model,
        },
        telemetry: null,
      };
    }

    try {
      const { rawDecision, telemetry } = await this.invokeRouterModel(input);
      const parsed = (() => {
        try {
          return parseRoutingDecision(rawDecision);
        } catch (error) {
          throw createRouterParseError(error, telemetry);
        }
      })();
      const resolved = this.config.resolveExecutionRoute({
        tier: parsed.tier,
      });

      return {
        decision: {
          tier: parsed.tier,
          confidence: parsed.confidence,
          reason: parsed.reason,
          fallbackReason: null,
          selectedProvider: resolved.provider,
          selectedModel: resolved.model,
        },
        telemetry,
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
        decision: {
          tier: 'fast',
          confidence: 0,
          reason: 'Fallback routing policy applied.',
          fallbackReason,
          selectedProvider: fallback.provider,
          selectedModel: fallback.model,
        },
        telemetry: extractRouterTelemetry(error),
      };
    }
  }

  private async invokeRouterModel(input: LlmRoutingRequest): Promise<RouterInvocationResult> {
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
              text: buildRouterSystemPrompt(),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: buildRouterUserInput(input),
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
    const requestRaw = body as Record<string, unknown>;

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new ProviderResponseError(
        `Router model request failed: ${error instanceof Error ? error.message : 'Unknown provider error'}`,
        {
          telemetry: createRouterTelemetry({
            provider: this.config.routerProvider,
            model: this.config.routerModel,
            requestRaw,
            responseRaw: {
              transportError:
                error instanceof Error ? error.message : 'Unknown provider error',
            },
            usage: unavailableUsage(),
          }),
        },
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => 'Unknown provider error');
      throw new ProviderResponseError(`Router model request failed: ${detail}`, {
        telemetry: createRouterTelemetry({
          provider: this.config.routerProvider,
          model: this.config.routerModel,
          requestRaw,
          responseRaw: {
            status: response.status,
            body: detail,
          },
          usage: unavailableUsage(),
        }),
      });
    }

    const rawPayload = await response.text().catch(() => '');
    let payload: RouterResponsePayload;
    try {
      payload = parseRouterResponsePayload(rawPayload);
    } catch {
      throw new ProviderResponseError('Router model returned an invalid JSON payload.', {
        telemetry: createRouterTelemetry({
          provider: this.config.routerProvider,
          model: this.config.routerModel,
          requestRaw,
          responseRaw: {
            body: rawPayload,
          },
          usage: unavailableUsage(),
        }),
      });
    }

    const telemetry = createRouterTelemetry({
      provider: this.config.routerProvider,
      model: this.config.routerModel,
      requestRaw,
      responseRaw: payload as Record<string, unknown>,
      usage: normalizeOpenAiUsage(payload.usage),
    });
    const text = extractResponseText(payload);
    if (!text) {
      throw new ProviderResponseError('Router model returned empty output.', {
        telemetry,
      });
    }

    try {
      return {
        rawDecision: parseRouterDecisionText(text),
        telemetry,
      };
    } catch (error) {
      throw createRouterParseError(error, telemetry);
    }
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

function buildRouterSystemPrompt(): string {
  return [
    'You are Monti\'s routing policy model.',
    'Choose between two execution tiers and return strict JSON with tier, confidence, reason.',
    'Tier definitions:',
    '- fast: routes to a faster, cheaper model. Use for straightforward, compact, single-concept experiences or simple refinements that do not require deep reasoning, high rigor, complex coordination, or extensive polish.',
    '- quality: routes to a slower, more capable model. Use only when the request clearly needs stronger reasoning, richer polish, complex coordination of constraints, substantial refinement work, or a higher-risk output where the fast tier is likely to underperform.',
    'Policy:',
    '- Default to fast when uncertain.',
    '- Choose quality only when there is clear evidence it will materially improve the result.',
    '- Topic complexity alone is not enough to justify quality.',
    '- Older or more advanced audiences do not automatically imply quality.',
    '- Refinement requests are not automatically quality; only upgrade when the requested changes are substantial or tightly constrained.',
    '- Prefer fast for ordinary generate requests, lightly constrained prompts, and narrow interactive slices of advanced subjects.',
    'Examples:',
    '- Generate a draggable fractions model for an elementary learner -> fast',
    '- Generate a university-level Bayes theorem simulator that teaches false positives, priors, and tradeoffs -> quality',
    '- Refine an experience to shorten copy and improve button labels -> fast',
    '- Refine an experience to redesign the interaction loop, pacing, and mobile usability while preserving the concept -> quality',
    'The reason field should name the strongest routing signal in plain language.',
  ].join('\n');
}

function buildRouterUserInput(input: LlmRoutingRequest): string {
  const lines = [
    'Request summary:',
    `- operation: ${input.operation}`,
    `- prompt: ${input.prompt}`,
    `- format: ${input.format ?? 'unspecified'}`,
    `- audience: ${input.audience ?? 'unspecified'}`,
    `- has_conversation_context: ${input.conversationContext?.trim() ? 'yes' : 'no'}`,
    `- refinement_instruction: ${input.refinementInstruction?.trim() ?? 'none'}`,
    `- prior_experience_available: ${input.hasPriorExperience ? 'yes' : 'no'}`,
  ];

  if (input.conversationContext?.trim()) {
    lines.push('- conversation_context:');
    lines.push(input.conversationContext.trim());
  }

  return lines.join('\n');
}

function createRouterTelemetry(input: {
  provider: ProviderKind;
  model: string;
  requestRaw: Record<string, unknown>;
  responseRaw: Record<string, unknown>;
  usage: LlmUsageTelemetry;
}): LlmRoutingTelemetry {
  return {
    provider: input.provider,
    model: input.model,
    requestRaw: input.requestRaw,
    responseRaw: input.responseRaw,
    usage: input.usage,
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

function parseRouterResponsePayload(rawPayload: string): RouterResponsePayload {
  const parsed = JSON.parse(rawPayload) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Router payload was not a JSON object.');
  }

  return parsed as RouterResponsePayload;
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

function createRouterParseError(
  error: unknown,
  telemetry: LlmRoutingTelemetry,
): ProviderResponseError {
  if (error instanceof AppError) {
    return new ProviderResponseError(error.message, {
      telemetry,
    });
  }

  if (error instanceof Error) {
    return new ProviderResponseError(error.message, {
      telemetry,
    });
  }

  return new ProviderResponseError('Router model output was not valid JSON.', {
    telemetry,
  });
}

function extractRouterTelemetry(error: unknown): LlmRoutingTelemetry | null {
  if (!(error instanceof AppError) || !isRecord(error.details) || !('telemetry' in error.details)) {
    return null;
  }

  const telemetry = error.details.telemetry;
  return isRecord(telemetry) ? (telemetry as unknown as LlmRoutingTelemetry) : null;
}

function isRouterStageEnabled(): boolean {
  const flag = process.env.ROUTER_STAGE_ENABLED?.trim().toLowerCase();
  return !(flag === 'false' || flag === '0' || flag === 'off');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
