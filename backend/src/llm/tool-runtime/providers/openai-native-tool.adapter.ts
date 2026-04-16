import { Injectable } from '@nestjs/common';
import {
  ProviderResponseError,
  ProviderUnavailableError,
} from '../../../common/errors/app-error';
import { normalizeOpenAiUsage } from '../../provider-usage';
import { createAssistantTextSnapshotEmitter } from '../assistant-text-stream';
import type { NativeToolAdapter } from '../native-tool-adapter.interface';
import { parseServerSentEvents } from '../sse-event-parser';
import type {
  CanonicalToolCall,
  CanonicalToolTurnRequest,
  CanonicalToolTurnResponse,
} from '../tool-runtime.types';

interface OpenAiNativeResponse {
  id?: string;
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
    name?: string;
    call_id?: string;
    arguments?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

interface OpenAiStreamEnvelope {
  type?: string;
  delta?: string;
  text?: string;
  response?: OpenAiNativeResponse;
  error?: {
    message?: string;
  };
}

@Injectable()
export class OpenAiNativeToolAdapter implements NativeToolAdapter {
  readonly provider = 'openai' as const;

  async executeTurn(request: CanonicalToolTurnRequest): Promise<CanonicalToolTurnResponse> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderUnavailableError('OPENAI_API_KEY is not configured.');
    }

    const body = {
      ...buildOpenAiToolRequest(request),
      stream: true,
      stream_options: {
        include_obfuscation: false,
      },
    };
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'Unknown provider error');
      throw new ProviderResponseError(`OpenAI native tool call failed: ${detail}`);
    }

    const textEmitter = createAssistantTextSnapshotEmitter(
      request.onAssistantTextSnapshot,
    );
    let payload: OpenAiNativeResponse | null = null;

    for await (const event of parseServerSentEvents(response)) {
      if (event.data === '[DONE]') {
        break;
      }

      const parsedEvent = parseJsonObjectEnvelope(event.data);
      if (!parsedEvent) {
        continue;
      }

      if (parsedEvent.type === 'response.output_text.delta') {
        await textEmitter.append(parsedEvent.delta);
        continue;
      }

      if (parsedEvent.type === 'response.output_text.done') {
        await textEmitter.replace(parsedEvent.text, true);
        continue;
      }

      if (parsedEvent.type === 'response.completed' && parsedEvent.response) {
        payload = parsedEvent.response;
        continue;
      }

      if (parsedEvent.type === 'error') {
        throw new ProviderResponseError(
          `OpenAI native tool call failed: ${parsedEvent.error?.message ?? 'Unknown provider error'}`,
        );
      }
    }

    if (!payload) {
      throw new ProviderResponseError(
        'OpenAI native tool call failed: streaming response ended without completion payload.',
      );
    }

    const parsed = parseOpenAiToolResponse(payload);
    await textEmitter.replace(parsed.assistantText, true);
    await textEmitter.flush();

    return {
      provider: this.provider,
      model: request.model,
      assistantText: parsed.assistantText,
      toolCalls: parsed.toolCalls,
      finishReason: parsed.finishReason,
      usage: normalizeOpenAiUsage(payload.usage),
      rawRequest: body,
      rawResponse: payload as Record<string, unknown>,
    };
  }
}

/**
 * OpenAI Responses API documents `previous_response_id` for multi-turn continuity, but
 * server-side retention / TTL is not clearly specified for long-lived chat threads, and
 * community reports show fragile behavior when pairing continuation IDs with tool
 * outputs across separate requests. We therefore reconstruct every turn as a stateless
 * `input` item list (user/system messages plus `function_call` / `function_call_output`
 * items) from canonical history and do not send `previous_response_id`.
 */
export function buildOpenAiToolRequest(request: CanonicalToolTurnRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    temperature: request.temperature,
    max_output_tokens: request.maxTokens,
    tools: request.tools.map((tool) => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    })),
  };

  const input: Array<Record<string, unknown>> = [];

  for (const message of request.messages) {
    if (message.role === 'system') {
      input.push({
        role: 'system',
        content: message.content,
      });
      continue;
    }

    if (message.role === 'user') {
      input.push({
        role: 'user',
        content: message.content,
      });
      continue;
    }

    if (message.role === 'assistant') {
      if (message.content.trim().length > 0) {
        input.push({
          role: 'assistant',
          content: message.content,
        });
      }

      if (message.toolCalls && message.toolCalls.length > 0) {
        for (const toolCall of message.toolCalls) {
          input.push({
            type: 'function_call',
            call_id: toolCall.id,
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.arguments),
          });
        }
      }

      continue;
    }

    if (message.role === 'tool') {
      input.push({
        type: 'function_call_output',
        call_id: message.toolCallId ?? randomId(),
        output: message.content,
      });
    }
  }

  body.input = input;
  return body;
}

export function parseOpenAiToolResponse(payload: OpenAiNativeResponse): {
  assistantText: string;
  toolCalls: CanonicalToolCall[];
  finishReason: CanonicalToolTurnResponse['finishReason'];
} {
  const output = Array.isArray(payload.output) ? payload.output : [];

  const toolCalls: CanonicalToolCall[] = output
    .filter((item) => item.type === 'function_call')
    .map((item) => ({
      id: item.call_id ?? item.name ?? randomId(),
      name: item.name ?? 'unknown_tool',
      arguments: parseJsonObject(item.arguments),
    }));

  const assistantText =
    typeof payload.output_text === 'string' && payload.output_text.trim().length > 0
      ? payload.output_text.trim()
      : output
          .flatMap((item) => item.content ?? [])
          .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
          .map((part) => part.text as string)
          .join('')
          .trim();

  let finishReason: CanonicalToolTurnResponse['finishReason'] = 'unknown';
  if (toolCalls.length > 0) {
    finishReason = 'tool_calls';
  } else if (payload.status === 'completed') {
    finishReason = 'stop';
  } else if (payload.incomplete_details?.reason === 'max_output_tokens') {
    finishReason = 'max_tokens';
  }

  return {
    assistantText,
    toolCalls,
    finishReason,
  };
}

function parseJsonObject(value: string | undefined): Record<string, unknown> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore and return fallback.
  }

  return {};
}

function parseJsonObjectEnvelope(value: string): OpenAiStreamEnvelope | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as OpenAiStreamEnvelope;
    }
  } catch {
    return null;
  }

  return null;
}

function randomId(): string {
  return `openai_tool_${Math.random().toString(36).slice(2, 10)}`;
}

