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

interface AnthropicContentBlock {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicNativeResponse {
  stop_reason?: string;
  content?: AnthropicContentBlock[];
}

@Injectable()
export class AnthropicNativeToolAdapter implements NativeToolAdapter {
  readonly provider = 'anthropic' as const;

  async executeTurn(request: CanonicalToolTurnRequest): Promise<CanonicalToolTurnResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderUnavailableError('ANTHROPIC_API_KEY is not configured.');
    }

    const body = buildAnthropicToolRequest(request);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'Unknown provider error');
      throw new ProviderResponseError(`Anthropic native tool call failed: ${detail}`);
    }

    const payload = (await response.json()) as AnthropicNativeResponse;
    const parsed = parseAnthropicToolResponse(payload);

    return {
      provider: this.provider,
      model: request.model,
      assistantText: parsed.assistantText,
      toolCalls: parsed.toolCalls,
      finishReason: parsed.finishReason,
      rawRequest: body,
      rawResponse: payload as Record<string, unknown>,
    };
  }
}

export function buildAnthropicToolRequest(request: CanonicalToolTurnRequest): Record<string, unknown> {
  const systemPrompt = request.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  const messages = request.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'tool' ? 'assistant' : message.role,
      content: message.content,
    }));

  return {
    model: request.model,
    max_tokens: request.maxTokens,
    temperature: request.temperature,
    ...(systemPrompt.length > 0 ? { system: systemPrompt } : {}),
    messages,
    tools: request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    })),
  };
}

export function parseAnthropicToolResponse(payload: AnthropicNativeResponse): {
  assistantText: string;
  toolCalls: CanonicalToolCall[];
  finishReason: CanonicalToolTurnResponse['finishReason'];
} {
  const content = Array.isArray(payload.content) ? payload.content : [];

  const toolCalls: CanonicalToolCall[] = content
    .filter((block) => block.type === 'tool_use')
    .map((block) => ({
      id: block.id ?? randomId(),
      name: block.name ?? 'unknown_tool',
      arguments: block.input ?? {},
    }));

  const assistantText = content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('')
    .trim();

  let finishReason: CanonicalToolTurnResponse['finishReason'] = 'unknown';
  if (toolCalls.length > 0 || payload.stop_reason === 'tool_use') {
    finishReason = 'tool_calls';
  } else if (payload.stop_reason === 'end_turn' || payload.stop_reason === 'stop_sequence') {
    finishReason = 'stop';
  } else if (payload.stop_reason === 'max_tokens') {
    finishReason = 'max_tokens';
  }

  return {
    assistantText,
    toolCalls,
    finishReason,
  };
}

function randomId(): string {
  return `anthropic_tool_${Math.random().toString(36).slice(2, 10)}`;
}
