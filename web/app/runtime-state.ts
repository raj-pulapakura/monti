export type ChatMessageRole = 'user' | 'assistant' | 'tool' | 'system';

export type ChatMessage = {
  id: string;
  threadId: string;
  userId: string;
  role: ChatMessageRole;
  content: string;
  contentJson: Record<string, unknown> | null;
  idempotencyKey: string | null;
  createdAt: string;
};

export type AssistantRun = {
  id: string;
  threadId: string;
  userMessageId: string;
  assistantMessageId: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  routerDecision: {
    tier: 'fast' | 'quality' | null;
    confidence: number | null;
    reason: string | null;
    fallbackReason: string | null;
  };
  selectedProvider: 'openai' | 'anthropic' | 'gemini' | null;
  selectedModel: string | null;
  error: {
    code: string | null;
    message: string | null;
  };
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ToolInvocation = {
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
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  error: {
    code: string | null;
    message: string | null;
  };
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type SandboxState = {
  threadId: string;
  status: 'empty' | 'creating' | 'ready' | 'error';
  experienceId: string | null;
  experienceVersionId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: string;
};

export type RuntimeState = {
  messages: ChatMessage[];
  activeRun: AssistantRun | null;
  activeToolInvocation: ToolInvocation | null;
  sandboxState: SandboxState | null;
  latestEventId: string | null;
};

export type RuntimeEventData = {
  threadId: string;
  runId: string | null;
  type:
    | 'run_started'
    | 'tool_started'
    | 'tool_succeeded'
    | 'tool_failed'
    | 'assistant_message_created'
    | 'sandbox_updated'
    | 'run_failed'
    | 'run_completed';
  payload: Record<string, unknown>;
  createdAt: string;
};

export type RuntimeHydrationSnapshot = {
  messages: ChatMessage[];
  activeRun: AssistantRun | null;
  activeToolInvocation: ToolInvocation | null;
  sandboxState: SandboxState;
  latestEventId: string | null;
};

export const INITIAL_RUNTIME_STATE: RuntimeState = {
  messages: [],
  activeRun: null,
  activeToolInvocation: null,
  sandboxState: null,
  latestEventId: null,
};

export function reduceRuntimeEvent(
  previous: RuntimeState,
  event: RuntimeEventData,
  latestEventId: string | null,
  now: () => string = () => new Date().toISOString(),
): RuntimeState {
  const next: RuntimeState = {
    ...previous,
    latestEventId: latestEventId ?? previous.latestEventId,
  };

  if (event.type === 'run_started' && next.activeRun) {
    next.activeRun = {
      ...next.activeRun,
      status: 'running',
    };
  }

  if (event.type === 'tool_started') {
    next.activeToolInvocation = {
      id:
        typeof event.payload.invocationId === 'string'
          ? event.payload.invocationId
          : next.activeToolInvocation?.id ?? `tool-${Date.now()}`,
      threadId: event.threadId,
      runId: event.runId ?? next.activeToolInvocation?.runId ?? '',
      providerToolCallId: null,
      toolName:
        typeof event.payload.toolName === 'string'
          ? event.payload.toolName
          : next.activeToolInvocation?.toolName ?? 'unknown_tool',
      toolArguments: next.activeToolInvocation?.toolArguments ?? {},
      toolResult: null,
      generationId: null,
      experienceId: null,
      experienceVersionId: null,
      status: 'running',
      error: {
        code: null,
        message: null,
      },
      startedAt: now(),
      completedAt: null,
      createdAt: now(),
    };
  }

  if (event.type === 'tool_succeeded' && next.activeToolInvocation) {
    next.activeToolInvocation = {
      ...next.activeToolInvocation,
      status: 'succeeded',
      generationId:
        typeof event.payload.generationId === 'string'
          ? event.payload.generationId
          : next.activeToolInvocation.generationId,
      completedAt: now(),
    };
  }

  if (event.type === 'tool_failed' && next.activeToolInvocation) {
    next.activeToolInvocation = {
      ...next.activeToolInvocation,
      status: 'failed',
      error: {
        code:
          typeof event.payload.errorCode === 'string'
            ? event.payload.errorCode
            : next.activeToolInvocation.error.code,
        message:
          typeof event.payload.errorMessage === 'string'
            ? event.payload.errorMessage
            : next.activeToolInvocation.error.message,
      },
      completedAt: now(),
    };
  }

  if (event.type === 'run_completed' && next.activeRun) {
    next.activeRun = {
      ...next.activeRun,
      status: 'succeeded',
    };
    next.activeToolInvocation = null;
  }

  if (event.type === 'run_failed' && next.activeRun) {
    const errorCode =
      typeof event.payload.errorCode === 'string'
        ? event.payload.errorCode
        : next.activeRun.error.code;
    const errorMessage =
      typeof event.payload.errorMessage === 'string'
        ? event.payload.errorMessage
        : next.activeRun.error.message;

    next.activeRun = {
      ...next.activeRun,
      status: 'failed',
      error: {
        code: errorCode,
        message: errorMessage,
      },
    };
    next.activeToolInvocation = null;
  }

  if (event.type === 'sandbox_updated' && next.sandboxState) {
    const incomingStatus = event.payload.status;
    if (
      incomingStatus === 'empty' ||
      incomingStatus === 'creating' ||
      incomingStatus === 'ready' ||
      incomingStatus === 'error'
    ) {
      next.sandboxState = {
        ...next.sandboxState,
        status: incomingStatus,
        lastErrorCode:
          typeof event.payload.errorCode === 'string'
            ? event.payload.errorCode
            : next.sandboxState.lastErrorCode,
        lastErrorMessage:
          typeof event.payload.errorMessage === 'string'
            ? event.payload.errorMessage
            : next.sandboxState.lastErrorMessage,
      };
    }
  }

  return next;
}

export function reconcileHydrationState(
  previous: RuntimeState,
  hydrated: RuntimeHydrationSnapshot,
): RuntimeState {
  return {
    ...previous,
    messages: hydrated.messages,
    activeRun: hydrated.activeRun,
    activeToolInvocation: hydrated.activeToolInvocation,
    sandboxState: hydrated.sandboxState,
    latestEventId: hydrated.latestEventId ?? previous.latestEventId,
  };
}

export function findLastUserMessage(
  messages: ChatMessage[],
): ChatMessage | undefined {
  return [...messages].reverse().find((message) => message.role === 'user');
}

export function getRetryComposerValue(
  run: AssistantRun | null,
  messages: ChatMessage[],
): string | null {
  if (run?.status !== 'failed') {
    return null;
  }

  return findLastUserMessage(messages)?.content ?? null;
}

export function getStatusLabel(
  run: AssistantRun | null,
  activeToolInvocation: ToolInvocation | null,
  sandbox: SandboxState | null,
): string | null {
  if (!run && !activeToolInvocation && !sandbox) {
    return null;
  }

  if (
    sandbox?.status === 'creating' ||
    run?.status === 'queued' ||
    run?.status === 'running' ||
    activeToolInvocation?.status === 'running'
  ) {
    return 'Drafting your studio';
  }

  if (
    sandbox?.status === 'error' ||
    run?.status === 'failed' ||
    activeToolInvocation?.status === 'failed'
  ) {
    return 'Needs your attention';
  }

  if (sandbox?.status === 'ready' || run?.status === 'succeeded') {
    return 'Draft ready';
  }

  return null;
}
