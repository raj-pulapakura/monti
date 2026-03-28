import { Injectable } from '@nestjs/common';
import {
  ProviderResponseError,
  ProviderUnavailableError,
} from '../../../common/errors/app-error';
import { createAssistantTextSnapshotEmitter } from '../assistant-text-stream';
import type { NativeToolAdapter } from '../native-tool-adapter.interface';
import { parseServerSentEvents } from '../sse-event-parser';
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

interface AnthropicStreamPayload {
  type?: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string | null;
  };
  message?: {
    stop_reason?: string | null;
  };
  content_block?: AnthropicContentBlock;
  error?: {
    message?: string;
  };
}

@Injectable()
export class AnthropicNativeToolAdapter implements NativeToolAdapter {
  readonly provider = 'anthropic' as const;

  async executeTurn(request: CanonicalToolTurnRequest): Promise<CanonicalToolTurnResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderUnavailableError('ANTHROPIC_API_KEY is not configured.');
    }

    const body = {
      ...buildAnthropicToolRequest(request),
      stream: true,
    };
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'Unknown provider error');
      throw new ProviderResponseError(`Anthropic native tool call failed: ${detail}`);
    }

    const textEmitter = createAssistantTextSnapshotEmitter(
      request.onAssistantTextSnapshot,
    );
    const contentBlocks: AnthropicContentBlock[] = [];
    const toolInputJsonByIndex = new Map<number, string>();
    let stopReason: string | undefined;

    for await (const event of parseServerSentEvents(response)) {
      if (event.data === '[DONE]') {
        break;
      }

      const payload = parseAnthropicStreamPayload(event.data);
      if (!payload) {
        continue;
      }

      if (payload.type === 'error') {
        throw new ProviderResponseError(
          `Anthropic native tool call failed: ${payload.error?.message ?? 'Unknown provider error'}`,
        );
      }

      const index = typeof payload.index === 'number' ? payload.index : null;

      if (payload.type === 'content_block_start' && index !== null) {
        contentBlocks[index] = payload.content_block ?? {};
        if (payload.content_block?.type === 'text') {
          await textEmitter.replace(joinAnthropicText(contentBlocks));
        }
        continue;
      }

      if (payload.type === 'content_block_delta' && index !== null) {
        const block = contentBlocks[index] ?? {};
        if (payload.delta?.type === 'text_delta') {
          contentBlocks[index] = {
            ...block,
            type: 'text',
            text: `${block.text ?? ''}${payload.delta.text ?? ''}`,
          };
          await textEmitter.replace(joinAnthropicText(contentBlocks));
          continue;
        }

        if (payload.delta?.type === 'input_json_delta') {
          toolInputJsonByIndex.set(
            index,
            `${toolInputJsonByIndex.get(index) ?? ''}${payload.delta.partial_json ?? ''}`,
          );
          continue;
        }
      }

      if (payload.type === 'content_block_stop' && index !== null) {
        const block = contentBlocks[index];
        if (block?.type === 'tool_use') {
          const partialJson = toolInputJsonByIndex.get(index);
          if (partialJson) {
            block.input = parseJsonObject(partialJson);
          }
        }
        continue;
      }

      if (payload.type === 'message_delta') {
        stopReason =
          payload.delta?.stop_reason ??
          payload.message?.stop_reason ??
          stopReason;
      }
    }

    const assembledPayload: AnthropicNativeResponse = {
      stop_reason: stopReason,
      content: contentBlocks.filter(Boolean),
    };
    const parsed = parseAnthropicToolResponse(assembledPayload);
    await textEmitter.replace(parsed.assistantText, true);
    await textEmitter.flush();

    return {
      provider: this.provider,
      model: request.model,
      assistantText: parsed.assistantText,
      toolCalls: parsed.toolCalls,
      finishReason: parsed.finishReason,
      providerContinuation:
        parsed.toolCalls.length > 0
          ? {
              anthropic: {
                pendingToolCalls: parsed.toolCalls.map((toolCall) => ({
                  id: toolCall.id,
                  name: toolCall.name,
                  arguments: toolCall.arguments,
                })),
              },
            }
          : undefined,
      rawRequest: body,
      rawResponse: assembledPayload as Record<string, unknown>,
    };
  }
}

export function buildAnthropicToolRequest(request: CanonicalToolTurnRequest): Record<string, unknown> {
  const systemPrompt = request.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  const pendingToolCalls = request.providerContinuation?.anthropic?.pendingToolCalls ?? [];
  const toolResults = extractTrailingToolMessages(request.messages);

  const messages: Array<Record<string, unknown>> = request.messages
    .filter((message) => message.role !== 'system' && message.role !== 'tool')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  if (pendingToolCalls.length > 0 && toolResults.length > 0) {
    messages.push({
      role: 'assistant',
      content: pendingToolCalls.map((toolCall) => ({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.arguments,
      })),
    });
    messages.push({
      role: 'user',
      content: toolResults.map((toolResult, index) => ({
        type: 'tool_result',
        tool_use_id: toolResult.toolCallId ?? pendingToolCalls[index]?.id ?? randomId(),
        content: toolResult.content,
      })),
    });
  }

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

function parseAnthropicStreamPayload(value: string): AnthropicStreamPayload | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as AnthropicStreamPayload;
    }
  } catch {
    return null;
  }

  return null;
}

function joinAnthropicText(content: AnthropicContentBlock[]): string {
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('');
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
    return {};
  }

  return {};
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
