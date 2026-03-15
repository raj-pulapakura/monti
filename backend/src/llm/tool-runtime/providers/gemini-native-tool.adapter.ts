import { Injectable } from '@nestjs/common';
import {
  ProviderResponseError,
  ProviderUnavailableError,
} from '../../../common/errors/app-error';
import type { NativeToolAdapter } from '../native-tool-adapter.interface';
import type {
  CanonicalToolCall,
  CanonicalToolTurnRequest,
  CanonicalToolTurnResponse,
} from '../tool-runtime.types';

interface GeminiPart {
  text?: string;
  functionCall?: {
    name?: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name?: string;
    response?: Record<string, unknown>;
  };
}

interface GeminiNativeResponse {
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
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'Unknown provider error');
      throw new ProviderResponseError(`Gemini native tool call failed: ${detail}`);
    }

    const payload = (await response.json()) as GeminiNativeResponse;
    const parsed = parseGeminiToolResponse(payload);

    return {
      provider: this.provider,
      model: request.model,
      assistantText: parsed.assistantText,
      toolCalls: parsed.toolCalls,
      finishReason: parsed.finishReason,
      providerContinuation:
        parsed.toolCalls.length > 0
          ? {
              gemini: {
                pendingToolCalls: parsed.toolCalls.map((toolCall) => ({
                  id: toolCall.id,
                  name: toolCall.name,
                  arguments: toolCall.arguments,
                })),
              },
            }
          : undefined,
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

  const pendingToolCalls = request.providerContinuation?.gemini?.pendingToolCalls ?? [];
  const toolResults = extractTrailingToolMessages(request.messages);

  const contents: Array<Record<string, unknown>> = request.messages
    .filter((message) => message.role !== 'system' && message.role !== 'tool')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

  if (pendingToolCalls.length > 0 && toolResults.length > 0) {
    contents.push({
      role: 'model',
      parts: pendingToolCalls.map((toolCall) => ({
        functionCall: {
          name: toolCall.name,
          args: toolCall.arguments,
        },
      })),
    });
    contents.push({
      role: 'user',
      parts: toolResults.map((toolResult, index) => ({
        functionResponse: {
          name: toolResult.toolName ?? pendingToolCalls[index]?.name ?? 'tool_result',
          response: parseJsonObject(toolResult.content),
        },
      })),
    });
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

function extractTrailingToolMessages(messages: CanonicalToolTurnRequest['messages']) {
  const trailing: CanonicalToolTurnRequest['messages'] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'tool') {
      break;
    }
    trailing.push(message);
  }

  return trailing.reverse();
}
