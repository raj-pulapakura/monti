import type { QualityMode } from '../../llm/llm.types';
import type { CanonicalToolDefinition } from '../../llm/tool-runtime/tool-runtime.types';

export interface ToolConfirmationMetadata {
  operation: string;
  estimatedCredits: { fast: number; quality: number };
}

export interface ToolExecuteInput {
  invocationId: string;
  threadId: string;
  runId: string;
  userId: string;
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  conversationContext?: string;
  requestedQualityMode?: QualityMode;
}

export interface ChatTool<TResult = unknown> {
  readonly name: string;
  readonly definition: CanonicalToolDefinition;
  requiresConfirmation(args: Record<string, unknown>): boolean;
  getConfirmationMetadata(args: Record<string, unknown>): ToolConfirmationMetadata;
  execute(input: ToolExecuteInput): Promise<TResult>;
}
