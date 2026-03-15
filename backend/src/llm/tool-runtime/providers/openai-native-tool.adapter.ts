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

interface OpenAiNativeResponse {
  id?: string;
  status?: string;
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

@Injectable()
export class OpenAiNativeToolAdapter implements NativeToolAdapter {
  readonly provider = 'openai' as const;

  async executeTurn(request: CanonicalToolTurnRequest): Promise<CanonicalToolTurnResponse> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderUnavailableError('OPENAI_API_KEY is not configured.');
    }

    const body = buildOpenAiToolRequest(request);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'Unknown provider error');
      throw new ProviderResponseError(`OpenAI native tool call failed: ${detail}`);
    }

    const payload = (await response.json()) as OpenAiNativeResponse;
    const parsed = parseOpenAiToolResponse(payload);

    return {
      provider: this.provider,
      model: request.model,
      assistantText: parsed.assistantText,
      toolCalls: parsed.toolCalls,
      finishReason: parsed.finishReason,
      providerContinuation:
        typeof payload.id === 'string' && payload.id.trim().length > 0
          ? {
              openai: {
                previousResponseId: payload.id,
              },
            }
          : undefined,
      rawRequest: body,
      rawResponse: payload as Record<string, unknown>,
    };
  }
}

export function buildOpenAiToolRequest(request: CanonicalToolTurnRequest): Record<string, unknown> {
  const continuationResponseId =
    request.providerContinuation?.openai?.previousResponseId?.trim() ?? '';

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

  if (continuationResponseId.length > 0) {
    const toolOutputs = extractTrailingToolMessages(request.messages);
    body.previous_response_id = continuationResponseId;
    body.input = toolOutputs.map((message) => ({
      type: 'function_call_output',
      call_id: message.toolCallId ?? randomId(),
      output: message.content,
    }));
    return body;
  }

  body.input = request.messages
    .filter((message) => message.role !== 'tool')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

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

function randomId(): string {
  return `openai_tool_${Math.random().toString(36).slice(2, 10)}`;
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
