import {
  getRetryComposerValue,
  INITIAL_RUNTIME_STATE,
  isRunActive,
  isUserFacingChatMessage,
  reconcileHydrationState,
  reduceRuntimeEvent,
  type ChatMessage,
  type RuntimeEventData,
  type RuntimeState,
} from './runtime-state';
import { describe, expect, it } from 'vitest';

function createBaseRuntimeState(): RuntimeState {
  return {
    ...INITIAL_RUNTIME_STATE,
    messages: [
      {
        id: 'message-1',
        threadId: 'thread-1',
        userId: 'client-1',
        role: 'user',
        content: 'Build a solar system quiz',
        contentJson: null,
        idempotencyKey: null,
        createdAt: '2026-03-15T10:00:00.000Z',
      },
    ],
    activeRun: {
      id: 'run-1',
      threadId: 'thread-1',
      userMessageId: 'message-1',
      assistantMessageId: null,
      status: 'queued',
      routerDecision: {
        tier: null,
        confidence: null,
        reason: null,
        fallbackReason: null,
      },
      selectedProvider: null,
      selectedModel: null,
      error: {
        code: null,
        message: null,
      },
      startedAt: null,
      completedAt: null,
      createdAt: '2026-03-15T10:00:00.000Z',
    },
    activeToolInvocation: null,
    sandboxState: {
      threadId: 'thread-1',
      status: 'empty',
      experienceId: null,
      experienceVersionId: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: '2026-03-15T10:00:00.000Z',
    },
    assistantDraft: null,
    latestEventId: '1',
  };
}

describe('runtime-state integration', () => {
  it('keeps deterministic event ordering across run/tool/sandbox updates', () => {
    const events: Array<{ id: string; event: RuntimeEventData }> = [
      {
        id: '2',
        event: {
          threadId: 'thread-1',
          runId: 'run-1',
          type: 'run_started',
          payload: {},
          createdAt: '2026-03-15T10:00:01.000Z',
        },
      },
      {
        id: '3',
        event: {
          threadId: 'thread-1',
          runId: 'run-1',
          type: 'tool_started',
          payload: {
            invocationId: 'tool-1',
            toolName: 'generate_experience',
          },
          createdAt: '2026-03-15T10:00:02.000Z',
        },
      },
      {
        id: '4',
        event: {
          threadId: 'thread-1',
          runId: 'run-1',
          type: 'sandbox_updated',
          payload: {
            status: 'creating',
          },
          createdAt: '2026-03-15T10:00:03.000Z',
        },
      },
      {
        id: '5',
        event: {
          threadId: 'thread-1',
          runId: 'run-1',
          type: 'tool_succeeded',
          payload: {
            invocationId: 'tool-1',
            generationId: 'gen-1',
          },
          createdAt: '2026-03-15T10:00:04.000Z',
        },
      },
      {
        id: '6',
        event: {
          threadId: 'thread-1',
          runId: 'run-1',
          type: 'sandbox_updated',
          payload: {
            status: 'ready',
          },
          createdAt: '2026-03-15T10:00:05.000Z',
        },
      },
      {
        id: '7',
        event: {
          threadId: 'thread-1',
          runId: 'run-1',
          type: 'run_completed',
          payload: {},
          createdAt: '2026-03-15T10:00:06.000Z',
        },
      },
    ];

    const now = (() => {
      let i = 0;
      const timestamps = [
        '2026-03-15T10:00:10.000Z',
        '2026-03-15T10:00:11.000Z',
        '2026-03-15T10:00:12.000Z',
      ];
      return () => timestamps[Math.min(i++, timestamps.length - 1)];
    })();

    const finalState = events.reduce(
      (state, current) =>
        reduceRuntimeEvent(state, current.event, current.id, now),
      createBaseRuntimeState(),
    );

    expect(finalState.latestEventId).toBe('7');
    expect(finalState.activeRun?.status).toBe('succeeded');
    expect(finalState.activeToolInvocation).toBeNull();
    expect(finalState.sandboxState?.status).toBe('ready');
  });

  it('reconciles hydration snapshots without losing cursor on null latestEventId', () => {
    const previous = createBaseRuntimeState();

    const reconciled = reconcileHydrationState(previous, {
      messages: [
        ...previous.messages,
        {
          id: 'assistant-1',
          threadId: 'thread-1',
          userId: 'client-1',
          role: 'assistant',
          content: 'Building now.',
          contentJson: null,
          idempotencyKey: null,
          createdAt: '2026-03-15T10:00:01.000Z',
        },
      ],
      activeRun: {
        ...previous.activeRun!,
        status: 'running',
      },
      activeToolInvocation: {
        id: 'tool-1',
        threadId: 'thread-1',
        runId: 'run-1',
        providerToolCallId: 'call_1',
        toolName: 'generate_experience',
        toolArguments: {
          operation: 'generate',
          prompt: 'Build quiz',
        },
        toolResult: null,
        generationId: null,
        experienceId: null,
        experienceVersionId: null,
        status: 'running',
        error: {
          code: null,
          message: null,
        },
        startedAt: '2026-03-15T10:00:02.000Z',
        completedAt: null,
        createdAt: '2026-03-15T10:00:02.000Z',
      },
      sandboxState: {
        ...previous.sandboxState!,
        status: 'creating',
      },
      latestEventId: null,
    });

    expect(reconciled.messages).toHaveLength(2);
    expect(reconciled.activeRun?.status).toBe('running');
    expect(reconciled.activeToolInvocation?.status).toBe('running');
    expect(reconciled.assistantDraft).toBeNull();
    expect(reconciled.latestEventId).toBe('1');
  });

  it('tracks streamed assistant drafts and clears them when the persisted message arrives', () => {
    const base = createBaseRuntimeState();

    const afterStarted = reduceRuntimeEvent(
      base,
      {
        threadId: 'thread-1',
        runId: 'run-1',
        type: 'assistant_message_started',
        payload: {
          draftId: 'run-1',
          content: 'Building',
        },
        createdAt: '2026-03-15T10:00:01.000Z',
      },
      '2',
    );
    const afterUpdated = reduceRuntimeEvent(
      afterStarted,
      {
        threadId: 'thread-1',
        runId: 'run-1',
        type: 'assistant_message_updated',
        payload: {
          draftId: 'run-1',
          content: 'Building the quiz now.',
        },
        createdAt: '2026-03-15T10:00:02.000Z',
      },
      '3',
    );
    const afterCreated = reduceRuntimeEvent(
      afterUpdated,
      {
        threadId: 'thread-1',
        runId: 'run-1',
        type: 'assistant_message_created',
        payload: {
          messageId: 'assistant-1',
          message: {
            id: 'assistant-1',
            threadId: 'thread-1',
            userId: 'client-1',
            role: 'assistant',
            content: 'Building the quiz now.',
            contentJson: null,
            idempotencyKey: null,
            createdAt: '2026-03-15T10:00:03.000Z',
          },
        },
        createdAt: '2026-03-15T10:00:03.000Z',
      },
      '4',
    );

    expect(afterStarted.assistantDraft?.content).toBe('Building');
    expect(afterUpdated.assistantDraft?.content).toBe('Building the quiz now.');
    expect(afterCreated.assistantDraft).toBeNull();
    expect(afterCreated.messages.at(-1)?.content).toBe('Building the quiz now.');
  });

  it('preserves a failed draft across hydration when no persisted assistant message exists yet', () => {
    const previous = {
      ...createBaseRuntimeState(),
      activeRun: {
        ...createBaseRuntimeState().activeRun!,
        status: 'failed' as const,
      },
      assistantDraft: {
        draftId: 'run-1',
        threadId: 'thread-1',
        runId: 'run-1',
        content: 'Partial reply',
        createdAt: '2026-03-15T10:00:01.000Z',
        updatedAt: '2026-03-15T10:00:02.000Z',
      },
    };

    const reconciled = reconcileHydrationState(previous, {
      messages: previous.messages,
      activeRun: previous.activeRun,
      activeToolInvocation: null,
      sandboxState: previous.sandboxState!,
      latestEventId: null,
    });

    expect(reconciled.assistantDraft?.content).toBe('Partial reply');
    expect(reconciled.latestEventId).toBe('1');
  });

  it('returns retry composer content only when the active run failed', () => {
    const base = createBaseRuntimeState();

    const failedRunValue = getRetryComposerValue(
      {
        ...base.activeRun!,
        status: 'failed',
      },
      [
        ...base.messages,
        {
          id: 'assistant-1',
          threadId: 'thread-1',
          userId: 'client-1',
          role: 'assistant',
          content: 'That failed.',
          contentJson: null,
          idempotencyKey: null,
          createdAt: '2026-03-15T10:00:01.000Z',
        },
      ],
    );
    const succeededRunValue = getRetryComposerValue(
      {
        ...base.activeRun!,
        status: 'succeeded',
      },
      base.messages,
    );

    expect(failedRunValue).toBe('Build a solar system quiz');
    expect(succeededRunValue).toBeNull();
  });

  it('does not return retry composer content when the active run was cancelled', () => {
    const base = createBaseRuntimeState();
    const cancelledValue = getRetryComposerValue(
      {
        ...base.activeRun!,
        status: 'cancelled',
      },
      base.messages,
    );
    expect(cancelledValue).toBeNull();
  });

  it('applies run_cancelled by clearing draft and tool invocation', () => {
    const base = createBaseRuntimeState();
    const withDraft: RuntimeState = {
      ...base,
      activeRun: {
        ...base.activeRun!,
        status: 'running',
      },
      assistantDraft: {
        draftId: 'run-1',
        threadId: 'thread-1',
        runId: 'run-1',
        content: 'Streaming…',
        createdAt: '2026-03-15T10:00:01.000Z',
        updatedAt: '2026-03-15T10:00:02.000Z',
      },
      activeToolInvocation: {
        id: 'tool-1',
        threadId: 'thread-1',
        runId: 'run-1',
        providerToolCallId: 'call-1',
        toolName: 'generate_experience',
        toolArguments: {},
        toolResult: null,
        generationId: null,
        experienceId: null,
        experienceVersionId: null,
        status: 'running',
        error: { code: null, message: null },
        startedAt: '2026-03-15T10:00:02.000Z',
        completedAt: null,
        createdAt: '2026-03-15T10:00:02.000Z',
      },
    };

    const next = reduceRuntimeEvent(
      withDraft,
      {
        threadId: 'thread-1',
        runId: 'run-1',
        type: 'run_cancelled',
        payload: { runId: 'run-1' },
        createdAt: '2026-03-15T10:00:05.000Z',
      },
      '7',
    );

    expect(next.activeRun?.status).toBe('cancelled');
    expect(next.assistantDraft).toBeNull();
    expect(next.activeToolInvocation).toBeNull();
  });

  it('treats cancelled runs as inactive for isRunActive', () => {
    const base = createBaseRuntimeState();
    expect(
      isRunActive({
        ...base.activeRun!,
        status: 'cancelled',
      }),
    ).toBe(false);
  });
});

describe('isUserFacingChatMessage', () => {
  const base = (overrides: Partial<ChatMessage>): ChatMessage => ({
    id: 'm1',
    threadId: 't1',
    userId: 'u1',
    role: 'assistant',
    content: '',
    contentJson: null,
    idempotencyKey: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('hides persisted tool-role rows (LLM-facing tool results)', () => {
    expect(
      isUserFacingChatMessage(
        base({
          role: 'tool',
          content: '{"status":"succeeded","operation":"generate"}',
          contentJson: { toolCallId: 'c1', toolName: 'generate_experience' },
        }),
      ),
    ).toBe(false);
  });

  it('hides assistant rows that only persist tool calls with no visible text', () => {
    expect(
      isUserFacingChatMessage(
        base({
          role: 'assistant',
          content: '',
          contentJson: {
            toolCalls: [{ id: 'call-1', name: 'generate_experience', arguments: {} }],
          },
        }),
      ),
    ).toBe(false);
  });

  it('keeps assistant rows that include text alongside tool calls', () => {
    expect(
      isUserFacingChatMessage(
        base({
          role: 'assistant',
          content: 'Calling the tool now.',
          contentJson: {
            toolCalls: [{ id: 'call-1', name: 'generate_experience', arguments: {} }],
          },
        }),
      ),
    ).toBe(true);
  });

  it('keeps normal assistant replies without tool calls metadata', () => {
    expect(
      isUserFacingChatMessage(
        base({
          content: 'Here is your game.',
          contentJson: { provider: 'openai', model: 'gpt-5' },
        }),
      ),
    ).toBe(true);
  });
});
