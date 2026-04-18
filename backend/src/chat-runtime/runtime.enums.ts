export const CHAT_MESSAGE_ROLES = ['user', 'assistant', 'tool', 'system'] as const;
export type ChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];

export const ASSISTANT_RUN_STATUSES = [
  'queued',
  'running',
  'awaiting_confirmation',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type AssistantRunStatus = (typeof ASSISTANT_RUN_STATUSES)[number];

export const TOOL_INVOCATION_STATUSES = ['pending', 'running', 'succeeded', 'failed'] as const;
export type ToolInvocationStatus = (typeof TOOL_INVOCATION_STATUSES)[number];

export const SANDBOX_STATUSES = ['empty', 'creating', 'ready', 'error'] as const;
export type SandboxStatus = (typeof SANDBOX_STATUSES)[number];

export const RUNTIME_EVENT_TYPES = [
  'run_started',
  'tool_started',
  'tool_succeeded',
  'tool_failed',
  'assistant_message_started',
  'assistant_message_updated',
  'assistant_message_created',
  'sandbox_updated',
  'run_failed',
  'run_completed',
  'confirmation_required',
] as const;
export type RuntimeEventType = (typeof RUNTIME_EVENT_TYPES)[number];
