import type { ProviderKind } from '../llm.types';

export type CanonicalChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface CanonicalChatMessage {
  role: CanonicalChatRole;
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface CanonicalToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface CanonicalToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface CanonicalToolTurnRequest {
  requestId?: string;
  provider: ProviderKind;
  model: string;
  maxTokens: number;
  temperature?: number;
  providerContinuation?: ProviderContinuationState;
  messages: CanonicalChatMessage[];
  tools: CanonicalToolDefinition[];
  signal?: AbortSignal;
  onAssistantTextSnapshot?: (text: string) => void | Promise<void>;
}

export interface CanonicalToolTurnResponse {
  provider: ProviderKind;
  model: string;
  assistantText: string;
  toolCalls: CanonicalToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'max_tokens' | 'unknown';
  providerContinuation?: ProviderContinuationState;
  rawRequest: Record<string, unknown>;
  rawResponse: Record<string, unknown>;
}

export interface ProviderContinuationState {
  openai?: {
    previousResponseId: string;
  };
  anthropic?: {
    pendingToolCalls: ContinuationToolCallState[];
  };
  gemini?: {
    pendingToolCalls: ContinuationToolCallState[];
  };
}

export interface ContinuationToolCallState {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}
