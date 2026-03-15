import {
  getRetryComposerValue,
  INITIAL_RUNTIME_STATE,
  reconcileHydrationState,
  reduceRuntimeEvent,
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
        clientId: 'client-1',
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
          clientId: 'client-1',
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
          clientId: 'client-1',
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
});
