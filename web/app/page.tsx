'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getOrCreateClientId } from '@/lib/client-id.js';
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
} from './runtime-state';

type AudienceLevel = 'young-kids' | 'elementary' | 'middle-school';
type ExperienceFormat = 'quiz' | 'game' | 'explainer';

type ThreadEnvelope = {
  id: string;
  clientId: string;
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

type ThreadCreateResponse = {
  ok: true;
  data: {
    thread: ThreadEnvelope;
    sandboxState: SandboxState;
  };
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

type ErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
const ACTIVE_THREAD_STORAGE_KEY = 'monti_active_thread_id_v1';

export default function Home() {
  const [clientId, setClientId] = useState('');
  const [thread, setThread] = useState<ThreadEnvelope | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>(INITIAL_RUNTIME_STATE);
  const [activeExperience, setActiveExperience] = useState<ExperiencePayload | null>(null);
  const [composerText, setComposerText] = useState('');
  const [format, setFormat] = useState<ExperienceFormat>('quiz');
  const [audience, setAudience] = useState<AudienceLevel>('elementary');
  const [submitting, setSubmitting] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void bootstrapThread();
  }, []);

  useEffect(() => {
    if (!thread?.id) {
      return;
    }

    const cursor = runtimeState.latestEventId;
    const params = new URLSearchParams();
    if (cursor) {
      params.set('cursor', cursor);
    }

    const streamUrl = `${API_BASE_URL}/api/chat/threads/${thread.id}/events${params.size > 0 ? `?${params.toString()}` : ''}`;
    const source = new EventSource(streamUrl);

    const eventTypes: Array<RuntimeEventData['type']> = [
      'run_started',
      'tool_started',
      'tool_succeeded',
      'tool_failed',
      'assistant_message_created',
      'sandbox_updated',
      'run_failed',
      'run_completed',
    ];

    const onRuntimeEvent = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;
      const parsed = parseRuntimeEvent(messageEvent.data);
      if (!parsed) {
        return;
      }

      const latestEventId =
        typeof messageEvent.lastEventId === 'string' && messageEvent.lastEventId.length > 0
          ? messageEvent.lastEventId
          : runtimeState.latestEventId;

      setRuntimeState((previous) => reduceRuntimeEvent(previous, parsed, latestEventId));

      if (parsed.type === 'assistant_message_created' || parsed.type === 'run_completed' || parsed.type === 'run_failed') {
        void refreshThreadSnapshot(thread.id, clientId);
      }

      if (parsed.type === 'sandbox_updated' || parsed.type === 'tool_succeeded' || parsed.type === 'tool_failed') {
        void refreshSandboxPreview(thread.id, clientId);
      }
    };

    eventTypes.forEach((eventType) => {
      source.addEventListener(eventType, onRuntimeEvent as EventListener);
    });

    source.onopen = () => {
      setStreamConnected(true);
    };

    source.onerror = () => {
      setStreamConnected(false);
    };

    return () => {
      eventTypes.forEach((eventType) => {
        source.removeEventListener(eventType, onRuntimeEvent as EventListener);
      });
      source.close();
      setStreamConnected(false);
    };
  }, [thread?.id, clientId]);

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

  async function bootstrapThread() {
    const nextClientId = getOrCreateClientId();
    setClientId(nextClientId);

    let threadId = readStoredThreadId();
    if (!threadId) {
      threadId = await createThread(nextClientId);
    }

    const hydrated = await fetchThreadHydration(threadId, nextClientId).catch(async () => {
      const replacementId = await createThread(nextClientId);
      return fetchThreadHydration(replacementId, nextClientId);
    });

    setThread(hydrated.thread);
    setRuntimeState({
      messages: hydrated.messages,
      activeRun: hydrated.activeRun,
      activeToolInvocation: hydrated.activeToolInvocation,
      sandboxState: hydrated.sandboxState,
      latestEventId: hydrated.latestEventId,
    });

    await refreshSandboxPreview(hydrated.thread.id, nextClientId);
  }

  async function createThread(nextClientId: string): Promise<string> {
    const response = await postJson<ThreadCreateResponse>('/api/chat/threads', {
      clientId: nextClientId,
    });

    const nextThreadId = response.data.thread.id;
    writeStoredThreadId(nextThreadId);
    return nextThreadId;
  }

  async function refreshThreadSnapshot(threadId: string, nextClientId: string) {
    const hydrated = await fetchThreadHydration(threadId, nextClientId);

    setThread(hydrated.thread);
    setRuntimeState((previous) => reconcileHydrationState(previous, hydrated));
  }

  async function refreshSandboxPreview(threadId: string, nextClientId: string) {
    const response = await getJson<SandboxPreviewResponse>(
      `/api/chat/threads/${threadId}/sandbox?clientId=${encodeURIComponent(nextClientId)}`,
    );

    setRuntimeState((previous) => ({
      ...previous,
      sandboxState: response.data.sandboxState,
    }));
    setActiveExperience(response.data.activeExperience);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!thread?.id || !clientId || submitting) {
      return;
    }

    const trimmed = composerText.trim();
    if (trimmed.length === 0) {
      return;
    }

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      threadId: thread.id,
      clientId,
      role: 'user',
      content: trimmed,
      contentJson: null,
      idempotencyKey: null,
      createdAt: new Date().toISOString(),
    };

    setErrorMessage(null);
    setSubmitting(true);
    setComposerText('');
    setRuntimeState((previous) => ({
      ...previous,
      messages: [...previous.messages, optimisticMessage],
    }));

    try {
      const response = await postJson<SubmitMessageResponse>(
        `/api/chat/threads/${thread.id}/messages`,
        {
          clientId,
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
        refreshThreadSnapshot(thread.id, clientId),
        refreshSandboxPreview(thread.id, clientId),
      ]);
    } catch (error) {
      setRuntimeState((previous) => ({
        ...previous,
        messages: previous.messages.filter((message) => message.id !== optimisticId),
      }));
      setComposerText(trimmed);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
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
            {streamConnected ? 'Live updates' : 'Reconnecting'}
          </span>
          {statusLabel ? <span className="status-pill">{statusLabel}</span> : null}
        </div>
      </header>

      <main className="workspace-grid">
        <section className="chat-panel">
          <div className="chat-scroll">
            {runtimeState.messages.length === 0 ? (
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
              onClick={() => setComposerText('Refine this with simpler language and add a score summary.')}
            >
              Refine prompt suggestion
            </button>
          ) : null}

          <form onSubmit={handleSubmit} className="composer-row">
            <input
              value={composerText}
              onChange={(event) => setComposerText(event.target.value)}
              placeholder="Create anything..."
              disabled={!thread?.id || submitting}
            />
            <button type="submit" disabled={!thread?.id || submitting || composerText.trim().length === 0}>
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

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
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
        typeof event.payload === 'object' && event.payload !== null && !Array.isArray(event.payload)
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
  clientId: string,
): Promise<ThreadHydrationResponse['data']> {
  const response = await getJson<ThreadHydrationResponse>(
    `/api/chat/threads/${threadId}?clientId=${encodeURIComponent(clientId)}`,
  );
  return response.data;
}

function readStoredThreadId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY);
  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
}

function writeStoredThreadId(threadId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, threadId);
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
  });

  const responseBody = (await response.json().catch(() => null)) as
    | TResponse
    | ErrorResponse
    | null;

  if (!response.ok) {
    const message =
      responseBody && typeof responseBody === 'object' && 'error' in responseBody
        ? responseBody.error.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (!responseBody) {
    throw new Error('Server returned an empty response.');
  }

  return responseBody as TResponse;
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseBody = (await response.json().catch(() => null)) as
    | TResponse
    | ErrorResponse
    | null;

  if (!response.ok) {
    const message =
      responseBody && typeof responseBody === 'object' && 'error' in responseBody
        ? responseBody.error.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (!responseBody) {
    throw new Error('Server returned an empty response.');
  }

  return responseBody as TResponse;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Something went wrong while processing the message.';
}
