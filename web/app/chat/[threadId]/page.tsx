'use client';

import { fetchEventSource } from '@microsoft/fetch-event-source';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  API_BASE_URL,
  createAuthenticatedApiClient,
} from '@/lib/api/authenticated-api-client';
import { consumeHomePromptHandoff } from '@/lib/chat/prompt-handoff';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  getRetryComposerValue,
  getStatusLabel,
  INITIAL_RUNTIME_STATE,
  reconcileHydrationState,
  reduceRuntimeEvent,
  type AssistantRun,
  type ChatMessage,
  type RuntimeEventData,
  type RuntimeState,
  type SandboxState,
  type ToolInvocation,
} from '../../runtime-state';

type AudienceLevel = 'young-kids' | 'elementary' | 'middle-school';
type ExperienceFormat = 'quiz' | 'game' | 'explainer';

type ThreadEnvelope = {
  id: string;
  userId: string;
  title: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ExperiencePayload = {
  title: string;
  description: string;
  html: string;
  css: string;
  js: string;
  generationId: string;
};

type ThreadHydrationResponse = {
  ok: true;
  data: {
    thread: ThreadEnvelope;
    messages: ChatMessage[];
    sandboxState: SandboxState;
    activeRun: AssistantRun | null;
    activeToolInvocation: ToolInvocation | null;
    latestEventId: string | null;
  };
};

type SubmitMessageResponse = {
  ok: true;
  data: {
    threadId: string;
    message: ChatMessage;
    run: AssistantRun | null;
    deduplicated: boolean;
  };
};

type SandboxPreviewResponse = {
  ok: true;
  data: {
    sandboxState: SandboxState;
    activeExperience: ExperiencePayload | null;
  };
};

class FatalStreamAuthError extends Error {}

export default function ChatThreadPage() {
  const params = useParams<{ threadId: string }>();
  const routeThreadId = resolveRouteThreadId(params.threadId);
  const threadIdIsValid = isUuidLike(routeThreadId);
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(
    null,
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadEnvelope | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>(INITIAL_RUNTIME_STATE);
  const [activeExperience, setActiveExperience] = useState<ExperiencePayload | null>(null);
  const [composerText, setComposerText] = useState('');
  const [format, setFormat] = useState<ExperienceFormat>('quiz');
  const [audience, setAudience] = useState<AudienceLevel>('elementary');
  const [submitting, setSubmitting] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const latestEventIdRef = useRef<string | null>(null);
  const handoffAttemptedThreadRef = useRef<string | null>(null);

  function getSupabaseClient() {
    if (supabaseRef.current) {
      return supabaseRef.current;
    }

    try {
      supabaseRef.current = createSupabaseBrowserClient();
      return supabaseRef.current;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Supabase authentication is not configured.',
      );
      return null;
    }
  }

  useEffect(() => {
    latestEventIdRef.current = runtimeState.latestEventId;
  }, [runtimeState.latestEventId]);

  useEffect(() => {
    setThread(null);
    setRuntimeState(INITIAL_RUNTIME_STATE);
    setActiveExperience(null);
    setErrorMessage(null);
    handoffAttemptedThreadRef.current = null;
  }, [routeThreadId]);

  useEffect(() => {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      return;
    }

    void syncSession(supabaseClient);

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);
      if (!token) {
        setThread(null);
        setRuntimeState(INITIAL_RUNTIME_STATE);
        router.replace('/auth/sign-in');
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    if (!threadIdIsValid) {
      setErrorMessage('Invalid chat URL. Use a valid thread link.');
      return;
    }

    void hydrateAndSetThreadState(routeThreadId, accessToken).catch((error) => {
      setThread(null);
      setErrorMessage(toErrorMessage(error));
    });
  }, [accessToken, routeThreadId, threadIdIsValid]);

  useEffect(() => {
    if (!accessToken || !thread?.id) {
      return;
    }

    if (handoffAttemptedThreadRef.current === thread.id) {
      return;
    }
    handoffAttemptedThreadRef.current = thread.id;

    const handoffPrompt = consumeHomePromptHandoff(thread.id);
    if (!handoffPrompt) {
      return;
    }

    void submitPrompt({
      prompt: handoffPrompt,
      token: accessToken,
      activeThread: thread,
      resetComposerOnSuccess: false,
    });
  }, [accessToken, thread?.id]);

  useEffect(() => {
    if (!thread?.id || !accessToken) {
      return;
    }

    const cursor = latestEventIdRef.current;
    const params = new URLSearchParams();
    if (cursor) {
      params.set('cursor', cursor);
    }

    const streamUrl = `${API_BASE_URL}/api/chat/threads/${thread.id}/events${params.size > 0 ? `?${params.toString()}` : ''}`;
    const abortController = new AbortController();

    const eventTypes = new Set<RuntimeEventData['type']>([
      'run_started',
      'tool_started',
      'tool_succeeded',
      'tool_failed',
      'assistant_message_created',
      'sandbox_updated',
      'run_failed',
      'run_completed',
    ]);

    void fetchEventSource(streamUrl, {
      method: 'GET',
      signal: abortController.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(cursor ? { 'Last-Event-ID': cursor } : {}),
      },
      openWhenHidden: true,
      async onopen(response) {
        if (response.status === 401 || response.status === 403) {
          setErrorMessage('Your session expired. Please sign in again.');
          const supabaseClient = getSupabaseClient();
          if (supabaseClient) {
            await supabaseClient.auth.signOut();
          }
          throw new FatalStreamAuthError('Unauthorized stream request.');
        }

        if (!response.ok) {
          throw new Error(`Stream request failed with status ${response.status}`);
        }

        setStreamConnected(true);
      },
      onmessage(message) {
        if (!message.event || !eventTypes.has(message.event as RuntimeEventData['type'])) {
          return;
        }

        const parsed = parseRuntimeEvent(message.data);
        if (!parsed) {
          return;
        }

        const latestEventId =
          typeof message.id === 'string' && message.id.length > 0
            ? message.id
            : latestEventIdRef.current;
        latestEventIdRef.current = latestEventId ?? null;

        setRuntimeState((previous) => reduceRuntimeEvent(previous, parsed, latestEventId ?? null));

        if (
          parsed.type === 'assistant_message_created' ||
          parsed.type === 'run_completed' ||
          parsed.type === 'run_failed'
        ) {
          void refreshThreadSnapshot(thread.id, accessToken);
        }

        if (
          parsed.type === 'sandbox_updated' ||
          parsed.type === 'tool_succeeded' ||
          parsed.type === 'tool_failed'
        ) {
          void refreshSandboxPreview(thread.id, accessToken);
        }
      },
      onclose() {
        setStreamConnected(false);
      },
      onerror(error) {
        setStreamConnected(false);
        if (error instanceof FatalStreamAuthError) {
          throw error;
        }
        console.error('Runtime event stream error:', error);
      },
    });

    return () => {
      abortController.abort();
      setStreamConnected(false);
    };
  }, [thread?.id, accessToken]);

  const previewDocument = useMemo(() => {
    if (!activeExperience) {
      return '';
    }

    const sanitizedJs = activeExperience.js.replace(/<\/script/gi, '<\\/script');

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${activeExperience.css}</style>
  </head>
  <body>
    ${activeExperience.html}
    <script>${sanitizedJs}</script>
  </body>
</html>`;
  }, [activeExperience]);

  const statusLabel = getStatusLabel(
    runtimeState.activeRun,
    runtimeState.activeToolInvocation,
    runtimeState.sandboxState,
  );

  async function syncSession(
    supabaseClient: ReturnType<typeof createSupabaseBrowserClient>,
  ) {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const token = data.session?.access_token ?? null;
    setAccessToken(token);

    if (!token) {
      router.replace('/auth/sign-in');
    }
  }

  async function hydrateAndSetThreadState(threadId: string, token: string) {
    const hydrated = await fetchThreadHydration(threadId, token);

    setThread(hydrated.thread);
    setRuntimeState({
      messages: hydrated.messages,
      activeRun: hydrated.activeRun,
      activeToolInvocation: hydrated.activeToolInvocation,
      sandboxState: hydrated.sandboxState,
      latestEventId: hydrated.latestEventId,
    });

    await refreshSandboxPreview(hydrated.thread.id, token);
    return hydrated.thread;
  }

  async function refreshThreadSnapshot(threadId: string, token: string) {
    const hydrated = await fetchThreadHydration(threadId, token);
    setThread(hydrated.thread);
    setRuntimeState((previous) => reconcileHydrationState(previous, hydrated));
  }

  async function refreshSandboxPreview(threadId: string, token: string) {
    const response = await apiClientFor(token).getJson<SandboxPreviewResponse>(
      `/api/chat/threads/${threadId}/sandbox`,
    );

    setRuntimeState((previous) => ({
      ...previous,
      sandboxState: response.data.sandboxState,
    }));
    setActiveExperience(response.data.activeExperience);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!accessToken || submitting || !thread?.id) {
      return;
    }

    const trimmed = composerText.trim();
    if (trimmed.length === 0) {
      return;
    }

    await submitPrompt({
      prompt: trimmed,
      token: accessToken,
      activeThread: thread,
      resetComposerOnSuccess: true,
    });
  }

  async function submitPrompt(input: {
    prompt: string;
    token: string;
    activeThread: ThreadEnvelope;
    resetComposerOnSuccess: boolean;
  }) {
    if (submitting) {
      return;
    }

    const trimmed = input.prompt.trim();
    if (trimmed.length === 0) {
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);
    let optimisticId: string | null = null;

    try {
      optimisticId = `temp-${Date.now()}`;

      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        threadId: input.activeThread.id,
        userId: input.activeThread.userId,
        role: 'user',
        content: trimmed,
        contentJson: null,
        idempotencyKey: null,
        createdAt: new Date().toISOString(),
      };

      if (input.resetComposerOnSuccess) {
        setComposerText('');
      }
      setRuntimeState((previous) => ({
        ...previous,
        messages: [...previous.messages, optimisticMessage],
      }));

      const response = await apiClientFor(input.token).postJson<SubmitMessageResponse>(
        `/api/chat/threads/${input.activeThread.id}/messages`,
        {
          content: buildPromptWithContext(trimmed, format, audience),
          idempotencyKey: createIdempotencyKey(),
        },
      );

      setRuntimeState((previous) => ({
        ...previous,
        activeRun: response.data.run,
        activeToolInvocation: null,
      }));

      await Promise.all([
        refreshThreadSnapshot(input.activeThread.id, input.token),
        refreshSandboxPreview(input.activeThread.id, input.token),
      ]);
    } catch (error) {
      if (optimisticId) {
        setRuntimeState((previous) => ({
          ...previous,
          messages: previous.messages.filter((message) => message.id !== optimisticId),
        }));
      }
      if (input.resetComposerOnSuccess) {
        setComposerText(trimmed);
      }
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      return;
    }

    await supabaseClient.auth.signOut();
    router.replace('/');
  }

  return (
    <div className="page-shell">
      <header className="hero-strip">
        <div>
          <p className="kicker">Monti Chat Runtime</p>
          <h1>Build experiences through chat</h1>
          <p className="hero-copy">
            Message-driven creation with tool execution and synchronized sandbox preview.
          </p>
        </div>
        <div className="status-badges">
          <span className={`connection-badge ${streamConnected ? 'online' : 'offline'}`}>
            {errorMessage && !thread?.id
              ? 'Setup failed'
              : !accessToken || !thread?.id
              ? 'Initializing'
              : streamConnected
                ? 'Live updates'
                : 'Reconnecting'}
          </span>
          {statusLabel ? <span className="status-pill">{statusLabel}</span> : null}
          <Link href="/" className="signout-button">
            Home
          </Link>
          <button type="button" className="signout-button" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="workspace-grid">
        <section className="chat-panel">
          <div className="chat-scroll">
            {!threadIdIsValid ? (
              <p className="empty-state">
                Invalid thread URL. Return to home and open a creation from the list.
              </p>
            ) : !thread?.id && errorMessage ? (
              <p className="empty-state">{errorMessage}</p>
            ) : !thread?.id ? (
              <p className="empty-state">Loading thread...</p>
            ) : runtimeState.messages.length === 0 ? (
              <p className="empty-state">Send a message to start generating an experience.</p>
            ) : (
              runtimeState.messages.map((message) => (
                <article
                  key={message.id}
                  className={`message-row ${message.role === 'user' ? 'message-user' : 'message-assistant'}`}
                >
                  <p className="message-role">{message.role === 'user' ? 'You' : 'Monti'}</p>
                  <p className="message-content">{message.content}</p>
                </article>
              ))
            )}
          </div>

          <div className="prompt-controls">
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as ExperienceFormat)}
            >
              <option value="quiz">Quiz</option>
              <option value="game">Game</option>
              <option value="explainer">Explainer</option>
            </select>
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value as AudienceLevel)}
            >
              <option value="young-kids">Young kids</option>
              <option value="elementary">Elementary</option>
              <option value="middle-school">Middle school</option>
            </select>
          </div>

          {activeExperience ? (
            <button
              type="button"
              className="suggestion-chip"
              onClick={() =>
                setComposerText('Refine this with simpler language and add a score summary.')
              }
            >
              Refine prompt suggestion
            </button>
          ) : null}

          <form onSubmit={handleSubmit} className="composer-row">
            <input
              value={composerText}
              onChange={(event) => setComposerText(event.target.value)}
              placeholder="Create anything..."
              disabled={submitting || !thread?.id || !threadIdIsValid}
            />
            <button
              type="submit"
              disabled={
                !accessToken ||
                submitting ||
                composerText.trim().length === 0 ||
                !thread?.id ||
                !threadIdIsValid
              }
            >
              {submitting ? 'Sending...' : 'Send'}
            </button>
          </form>

          {getRetryComposerValue(runtimeState.activeRun, runtimeState.messages) ? (
            <button
              type="button"
              className="retry-button"
              onClick={() =>
                setComposerText(
                  getRetryComposerValue(runtimeState.activeRun, runtimeState.messages) ?? '',
                )
              }
            >
              Retry last request
            </button>
          ) : null}

          {errorMessage && thread?.id ? <p className="error-banner">{errorMessage}</p> : null}
        </section>

        <section className="sandbox-panel">
          <div className="sandbox-header">
            <h2>{activeExperience ? activeExperience.title : 'Sandbox preview'}</h2>
            <p>
              {runtimeState.sandboxState
                ? `Status: ${runtimeState.sandboxState.status}`
                : 'Status: empty'}
            </p>
          </div>

          {activeExperience ? (
            <iframe
              title="Monti sandbox preview"
              className="sandbox-iframe"
              sandbox="allow-scripts"
              srcDoc={previewDocument}
            />
          ) : (
            <div className="sandbox-empty">
              <p>Generated experience output will appear here.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function buildPromptWithContext(
  prompt: string,
  _format: ExperienceFormat,
  _audience: AudienceLevel,
): string {
  return prompt;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseRuntimeEvent(value: string): RuntimeEventData | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const event = parsed as Partial<RuntimeEventData>;
    if (typeof event.type !== 'string' || typeof event.threadId !== 'string') {
      return null;
    }

    if (typeof event.createdAt !== 'string') {
      return null;
    }

    return {
      threadId: event.threadId,
      runId: typeof event.runId === 'string' ? event.runId : null,
      type: event.type as RuntimeEventData['type'],
      payload:
        typeof event.payload === 'object' &&
        event.payload !== null &&
        !Array.isArray(event.payload)
          ? (event.payload as Record<string, unknown>)
          : {},
      createdAt: event.createdAt,
    };
  } catch {
    return null;
  }
}

async function fetchThreadHydration(
  threadId: string,
  token: string,
): Promise<ThreadHydrationResponse['data']> {
  const response = await apiClientFor(token).getJson<ThreadHydrationResponse>(
    `/api/chat/threads/${threadId}`,
  );
  return response.data;
}

function resolveRouteThreadId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function apiClientFor(accessToken: string) {
  return createAuthenticatedApiClient(accessToken);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Something went wrong while processing the message.';
}
