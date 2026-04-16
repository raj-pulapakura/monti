import { Injectable } from '@nestjs/common';
import {
  ProviderResponseError,
  ProviderUnavailableError,
} from '../../../common/errors/app-error';
import { normalizeGeminiUsage } from '../../provider-usage';
import { createAssistantTextSnapshotEmitter } from '../assistant-text-stream';
import type { NativeToolAdapter } from '../native-tool-adapter.interface';
import { parseServerSentEvents } from '../sse-event-parser';
import type {
  CanonicalToolCall,
  CanonicalToolTurnRequest,
  CanonicalToolTurnResponse,
} from '../tool-runtime.types';

interface GeminiPart {
  text?: string;
  functionCall?: {
    id?: string;
    name?: string;
    args?: Record<string, unknown>;
    partialArgs?: Array<{
      jsonPath?: string;
      stringValue?: string;
      numberValue?: number;
      boolValue?: boolean;
      nullValue?: null;
      willContinue?: boolean;
    }>;
    willContinue?: boolean;
  };
  functionResponse?: {
    name?: string;
    response?: Record<string, unknown>;
  };
}

interface GeminiNativeResponse {
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

@Injectable()
export class GeminiNativeToolAdapter implements NativeToolAdapter {
  readonly provider = 'gemini' as const;

  async executeTurn(request: CanonicalToolTurnRequest): Promise<CanonicalToolTurnResponse> {
    const apiKey = process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderUnavailableError(
        'GOOGLE_API_KEY is not configured (legacy fallback: GEMINI_API_KEY).',
      );
    }

    const body = buildGeminiToolRequest(request);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'Unknown provider error');
      throw new ProviderResponseError(`Gemini native tool call failed: ${detail}`);
    }

    const textEmitter = createAssistantTextSnapshotEmitter(
      request.onAssistantTextSnapshot,
    );
    const assistantTextParts: string[] = [];
    const toolCalls = new Map<
      string,
      {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
      }
    >();
    let finishReason: string | undefined;
    let usageMetadata: GeminiNativeResponse['usageMetadata'];

    for await (const event of parseServerSentEvents(response)) {
      if (event.data === '[DONE]') {
        break;
      }

      const chunk = parseGeminiStreamPayload(event.data);
      if (!chunk) {
        continue;
      }

      const candidate = chunk.candidates?.[0];
      if (!candidate) {
        continue;
      }

      if (chunk.usageMetadata) {
        usageMetadata = chunk.usageMetadata;
      }
      finishReason = candidate.finishReason ?? finishReason;
      const parts = Array.isArray(candidate.content?.parts)
        ? candidate.content.parts
        : [];

      for (const part of parts) {
        if (typeof part.text === 'string' && part.text.length > 0) {
          assistantTextParts.push(part.text);
          await textEmitter.replace(assistantTextParts.join(''));
        }

        if (!part.functionCall) {
          continue;
        }

        const functionCallId =
          part.functionCall.id ??
          `${part.functionCall.name ?? 'gemini_tool'}_${toolCalls.size}`;
        const existing = toolCalls.get(functionCallId) ?? {
          id: functionCallId,
          name: part.functionCall.name ?? 'unknown_tool',
          arguments: {},
        };
        existing.name = part.functionCall.name ?? existing.name;
        if (
          typeof part.functionCall.args === 'object' &&
          part.functionCall.args !== null &&
          !Array.isArray(part.functionCall.args)
        ) {
          existing.arguments = part.functionCall.args;
        } else if (Array.isArray(part.functionCall.partialArgs)) {
          existing.arguments = applyGeminiPartialArgs(
            existing.arguments,
            part.functionCall.partialArgs,
          );
        }
        toolCalls.set(functionCallId, existing);
      }
    }

    const payload: GeminiNativeResponse = {
      usageMetadata,
      candidates: [
        {
          finishReason,
          content: {
            parts: [
              ...(assistantTextParts.length > 0
                ? [{ text: assistantTextParts.join('') }]
                : []),
              ...[...toolCalls.values()].map((toolCall) => ({
                functionCall: {
                  id: toolCall.id,
                  name: toolCall.name,
                  args: toolCall.arguments,
                },
              })),
            ],
          },
        },
      ],
    };
    const parsed = parseGeminiToolResponse(payload);
    await textEmitter.replace(parsed.assistantText, true);
    await textEmitter.flush();

    return {
      provider: this.provider,
      model: request.model,
      assistantText: parsed.assistantText,
      toolCalls: parsed.toolCalls,
      finishReason: parsed.finishReason,
      usage: normalizeGeminiUsage(payload.usageMetadata),
      rawRequest: body,
      rawResponse: payload as Record<string, unknown>,
    };
  }
}

export function buildGeminiToolRequest(request: CanonicalToolTurnRequest): Record<string, unknown> {
  const systemPrompt = request.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  const contents: Array<Record<string, unknown>> = [];
  const nonSystem = request.messages.filter((message) => message.role !== 'system');

  let index = 0;
  while (index < nonSystem.length) {
    const message = nonSystem[index];
    if (message.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: message.content }],
      });
      index += 1;
      continue;
    }

    if (message.role === 'assistant') {
      if (message.toolCalls && message.toolCalls.length > 0) {
        const parts: Array<Record<string, unknown>> = [];
        if (message.content.trim().length > 0) {
          parts.push({ text: message.content });
        }

        for (const toolCall of message.toolCalls) {
          parts.push({
            functionCall: {
              id: toolCall.id,
              name: toolCall.name,
              args: toolCall.arguments,
            },
          });
        }

        contents.push({
          role: 'model',
          parts,
        });
        index += 1;

        const toolResults: CanonicalToolTurnRequest['messages'] = [];
        while (index < nonSystem.length && nonSystem[index].role === 'tool') {
          toolResults.push(nonSystem[index]);
          index += 1;
        }

        if (toolResults.length > 0) {
          contents.push({
            role: 'user',
            parts: toolResults.map((toolResult) => ({
              functionResponse: {
                name: toolResult.toolName ?? 'tool_result',
                response: parseJsonObject(toolResult.content),
              },
            })),
          });
        }
      } else {
        contents.push({
          role: 'model',
          parts: [{ text: message.content }],
        });
        index += 1;
      }
      continue;
    }

    if (message.role === 'tool') {
      index += 1;
      continue;
    }
  }

  return {
    ...(systemPrompt.length > 0
      ? {
          systemInstruction: {
            role: 'system',
            parts: [{ text: systemPrompt }],
          },
        }
      : {}),
    contents,
    tools: [
      {
        functionDeclarations: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        })),
      },
    ],
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
    },
  };
}

export function parseGeminiToolResponse(payload: GeminiNativeResponse): {
  assistantText: string;
  toolCalls: CanonicalToolCall[];
  finishReason: CanonicalToolTurnResponse['finishReason'];
} {
  const candidate = payload.candidates?.[0];
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];

  const toolCalls: CanonicalToolCall[] = parts
    .filter((part) => part.functionCall && typeof part.functionCall.name === 'string')
    .map((part) => ({
      id: `gemini_tool_${Math.random().toString(36).slice(2, 10)}`,
      name: part.functionCall?.name ?? 'unknown_tool',
      arguments: part.functionCall?.args ?? {},
    }));

  const assistantText = parts
    .filter((part) => typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('')
    .trim();

  let finishReason: CanonicalToolTurnResponse['finishReason'] = 'unknown';
  if (toolCalls.length > 0) {
    finishReason = 'tool_calls';
  } else if (candidate?.finishReason === 'STOP') {
    finishReason = 'stop';
  } else if (candidate?.finishReason === 'MAX_TOKENS') {
    finishReason = 'max_tokens';
  }

  return {
    assistantText,
    toolCalls,
    finishReason,
  };
}

function parseJsonObject(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore parse errors and return fallback.
  }

  return {
    value,
  };
}

function parseGeminiStreamPayload(value: string): GeminiNativeResponse | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as GeminiNativeResponse;
    }
  } catch {
    return null;
  }

  return null;
}

function applyGeminiPartialArgs(
  previous: Record<string, unknown>,
  partialArgs: Array<{
    jsonPath?: string;
    stringValue?: string;
    numberValue?: number;
    boolValue?: boolean;
    nullValue?: null;
    willContinue?: boolean;
  }>,
): Record<string, unknown> {
  const next = { ...previous };

  for (const partial of partialArgs) {
    const path = partial.jsonPath?.replace(/^\$\./, '').split('.');
    if (!path || path.length === 0 || path.some((segment) => segment.length === 0)) {
      continue;
    }

    let current: Record<string, unknown> = next;
    for (let index = 0; index < path.length - 1; index += 1) {
      const segment = path[index];
      const existing =
        typeof current[segment] === 'object' &&
        current[segment] !== null &&
        !Array.isArray(current[segment])
          ? (current[segment] as Record<string, unknown>)
          : {};
      current[segment] = existing;
      current = existing;
    }

    const finalSegment = path[path.length - 1];
    const existingValue = current[finalSegment];
    if (typeof partial.stringValue === 'string') {
      current[finalSegment] =
        typeof existingValue === 'string'
          ? `${existingValue}${partial.stringValue}`
          : partial.stringValue;
      continue;
    }

    if (typeof partial.numberValue === 'number') {
      current[finalSegment] = partial.numberValue;
      continue;
    }

    if (typeof partial.boolValue === 'boolean') {
      current[finalSegment] = partial.boolValue;
      continue;
    }

    if (partial.nullValue === null) {
      current[finalSegment] = null;
    }
  }

  return next;
}
