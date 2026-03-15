import type { ProviderKind } from '../llm/llm.types';
import type {
  AssistantRunStatus,
  ChatMessageRole,
  RuntimeEventType,
  SandboxStatus,
  ToolInvocationStatus,
} from './runtime.enums';

export interface ChatMessageEnvelope {
  id: string;
  threadId: string;
  clientId: string;
  role: ChatMessageRole;
  content: string;
  contentJson: Record<string, unknown> | null;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface AssistantRunEnvelope {
  id: string;
  threadId: string;
  userMessageId: string;
  assistantMessageId: string | null;
  status: AssistantRunStatus;
  routerDecision: {
    tier: 'fast' | 'quality' | null;
    confidence: number | null;
    reason: string | null;
    fallbackReason: string | null;
  };
  conversationModel: {
    provider: ProviderKind | null;
    model: string | null;
  };
  selectedProvider: ProviderKind | null;
  selectedModel: string | null;
  error: {
    code: string | null;
    message: string | null;
  };
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ToolInvocationEnvelope {
  id: string;
  threadId: string;
  runId: string;
  providerToolCallId: string | null;
  toolName: string;
  toolArguments: Record<string, unknown>;
  toolResult: Record<string, unknown> | null;
  generationId: string | null;
  experienceId: string | null;
  experienceVersionId: string | null;
  status: ToolInvocationStatus;
  error: {
    code: string | null;
    message: string | null;
  };
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface SandboxStateEnvelope {
  threadId: string;
  status: SandboxStatus;
  experienceId: string | null;
  experienceVersionId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: string;
}

export interface RuntimeEventEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  threadId: string;
  runId: string | null;
  type: RuntimeEventType;
  payload: TPayload;
  createdAt: string;
}
