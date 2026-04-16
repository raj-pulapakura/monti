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

function hasPersistedToolCalls(contentJson: Record<string, unknown> | null): boolean {
  const raw = contentJson?.toolCalls;
  return Array.isArray(raw) && raw.length > 0;
}

/**
 * Chat rows persisted for the LLM / tool pipeline (`role: tool`, or assistant rows that
 * only carry `content_json.toolCalls` with no user-visible text) are omitted from the
 * transcript UI — see `ConversationTimeline` consumers.
 */
export function isUserFacingChatMessage(message: ChatMessage): boolean {
  if (message.role === 'tool') {
    return false;
  }
  if (
    message.role === 'assistant' &&
    hasPersistedToolCalls(message.contentJson) &&
    message.content.trim().length === 0
  ) {
    return false;
  }
  return true;
}

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

export type AssistantDraft = {
  draftId: string;
  threadId: string;
  runId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeState = {
  messages: ChatMessage[];
  activeRun: AssistantRun | null;
  activeToolInvocation: ToolInvocation | null;
  sandboxState: SandboxState | null;
  assistantDraft: AssistantDraft | null;
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
    | 'assistant_message_started'
    | 'assistant_message_updated'
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
  assistantDraft: null,
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
      startedAt: next.activeRun.startedAt ?? event.createdAt,
      selectedProvider:
        event.payload.provider === 'openai' ||
        event.payload.provider === 'anthropic' ||
        event.payload.provider === 'gemini'
          ? event.payload.provider
          : next.activeRun.selectedProvider,
      selectedModel:
        typeof event.payload.model === 'string'
          ? event.payload.model
          : next.activeRun.selectedModel,
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
      startedAt: event.createdAt ?? now(),
      completedAt: null,
      createdAt: event.createdAt ?? now(),
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
      completedAt: event.createdAt ?? now(),
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
      completedAt: event.createdAt ?? now(),
    };
  }

  if (
    event.type === 'assistant_message_started' ||
    event.type === 'assistant_message_updated'
  ) {
    const draft = toAssistantDraft(event, next.assistantDraft);
    if (draft) {
      next.assistantDraft = draft;
    }
  }

  if (event.type === 'assistant_message_created') {
    const message = toAssistantMessage(event.payload);
    if (message) {
      next.messages = upsertMessage(next.messages, message);
    }
    next.assistantDraft = null;
  }

  if (event.type === 'run_completed' && next.activeRun) {
    next.activeRun = {
      ...next.activeRun,
      status: 'succeeded',
      completedAt: event.createdAt,
    };
    next.activeToolInvocation = null;
    next.assistantDraft = null;
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
      completedAt: event.createdAt,
    };
    next.activeToolInvocation = null;
  }

  if (event.type === 'sandbox_updated') {
    const incomingStatus = event.payload.status;
    if (
      incomingStatus === 'empty' ||
      incomingStatus === 'creating' ||
      incomingStatus === 'ready' ||
      incomingStatus === 'error'
    ) {
      const previousSandbox =
        next.sandboxState ??
        ({
          threadId: event.threadId,
          status: incomingStatus,
          experienceId: null,
          experienceVersionId: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          updatedAt: event.createdAt,
        } satisfies SandboxState);
      next.sandboxState = {
        ...previousSandbox,
        status: incomingStatus,
        experienceId:
          typeof event.payload.experienceId === 'string'
            ? event.payload.experienceId
            : previousSandbox.experienceId,
        experienceVersionId:
          typeof event.payload.experienceVersionId === 'string'
            ? event.payload.experienceVersionId
            : previousSandbox.experienceVersionId,
        lastErrorCode:
          typeof event.payload.errorCode === 'string'
            ? event.payload.errorCode
            : previousSandbox.lastErrorCode,
        lastErrorMessage:
          typeof event.payload.errorMessage === 'string'
            ? event.payload.errorMessage
            : previousSandbox.lastErrorMessage,
        updatedAt: event.createdAt,
      };
    }
  }

  return next;
}

/**
 * GET /threads/:id can race with the client optimistic user row (temp-* ids). If hydration
 * returns before the server lists the new message, keep those pending rows so the UI does not
 * flash the empty-thread state.
 */
export function mergeHydratedMessagesWithOptimistic(
  previousMessages: ChatMessage[],
  hydratedMessages: ChatMessage[],
): ChatMessage[] {
  const hydratedIds = new Set(hydratedMessages.map((m) => m.id));

  const optimisticPending = previousMessages.filter((m) => {
    if (!m.id.startsWith('temp-')) {
      return false;
    }
    if (hydratedIds.has(m.id)) {
      return false;
    }
    if (
      hydratedMessages.some(
        (h) => h.role === 'user' && h.content === m.content,
      )
    ) {
      return false;
    }
    return true;
  });

  if (optimisticPending.length === 0) {
    return hydratedMessages;
  }

  return [...hydratedMessages, ...optimisticPending].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function reconcileHydrationState(
  previous: RuntimeState,
  hydrated: RuntimeHydrationSnapshot,
): RuntimeState {
  const activeRunStillVisible =
    hydrated.activeRun?.status === 'queued' ||
    hydrated.activeRun?.status === 'running' ||
    hydrated.activeRun?.status === 'failed';
  const hasPersistedAssistantCopy =
    previous.assistantDraft !== null &&
    hydrated.messages.some(
      (message) =>
        message.role === 'assistant' &&
        message.content.trim() === previous.assistantDraft?.content.trim(),
    );

  return {
    ...previous,
    messages: mergeHydratedMessagesWithOptimistic(previous.messages, hydrated.messages),
    activeRun: hydrated.activeRun,
    activeToolInvocation: hydrated.activeToolInvocation,
    sandboxState: hydrated.sandboxState,
    assistantDraft:
      previous.assistantDraft && activeRunStillVisible && !hasPersistedAssistantCopy
        ? previous.assistantDraft
        : null,
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
  assistantDraft: AssistantDraft | null = null,
): string | null {
  if (!run && !activeToolInvocation && !sandbox && !assistantDraft) {
    return null;
  }

  if (
    assistantDraft ||
    sandbox?.status === 'creating' ||
    run?.status === 'queued' ||
    run?.status === 'running' ||
    activeToolInvocation?.status === 'running'
  ) {
    return 'Working on your request';
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

export function isRunActive(run: AssistantRun | null): boolean {
  return run?.status === 'queued' || run?.status === 'running';
}

function toAssistantDraft(
  event: RuntimeEventData,
  previousDraft: AssistantDraft | null,
): AssistantDraft | null {
  const content =
    typeof event.payload.content === 'string' ? event.payload.content.trim() : '';
  if (content.length === 0) {
    return null;
  }

  const draftId =
    typeof event.payload.draftId === 'string' && event.payload.draftId.trim().length > 0
      ? event.payload.draftId
      : event.runId ?? `draft-${event.threadId}`;

  return {
    draftId,
    threadId: event.threadId,
    runId: event.runId,
    content,
    createdAt:
      previousDraft && previousDraft.draftId === draftId
        ? previousDraft.createdAt
        : event.createdAt,
    updatedAt: event.createdAt,
  };
}

function toAssistantMessage(payload: Record<string, unknown>): ChatMessage | null {
  const candidate =
    typeof payload.message === 'object' &&
    payload.message !== null &&
    !Array.isArray(payload.message)
      ? (payload.message as Record<string, unknown>)
      : null;
  if (!candidate) {
    return null;
  }

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.threadId !== 'string' ||
    typeof candidate.userId !== 'string' ||
    typeof candidate.role !== 'string' ||
    typeof candidate.content !== 'string' ||
    typeof candidate.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    threadId: candidate.threadId,
    userId: candidate.userId,
    role: candidate.role as ChatMessageRole,
    content: candidate.content,
    contentJson:
      typeof candidate.contentJson === 'object' &&
      candidate.contentJson !== null &&
      !Array.isArray(candidate.contentJson)
        ? (candidate.contentJson as Record<string, unknown>)
        : null,
    idempotencyKey:
      typeof candidate.idempotencyKey === 'string' ? candidate.idempotencyKey : null,
    createdAt: candidate.createdAt,
  };
}

function upsertMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const nextMessages = messages.filter((existing) => existing.id !== message.id);
  nextMessages.push(message);
  nextMessages.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return nextMessages;
}
