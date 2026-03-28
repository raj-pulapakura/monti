'use client';

import { fetchEventSource } from '@microsoft/fetch-event-source';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowUp, Expand, LoaderCircle, X } from 'lucide-react';
import {
  API_BASE_URL,
  createAuthenticatedApiClient,
} from '@/lib/api/authenticated-api-client';
import { consumeHomePromptHandoff } from '@/lib/chat/prompt-handoff';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  isPreviewFullscreenSupported,
  isPreviewStageFullscreen,
  toPreviewFullscreenErrorMessage,
} from './fullscreen-preview';
import {
  getRetryComposerValue,
  INITIAL_RUNTIME_STATE,
  isRunActive,
  reconcileHydrationState,
  reduceRuntimeEvent,
  type AssistantRun,
  type ChatMessage,
  type RuntimeEventData,
  type RuntimeState,
  type SandboxState,
  type ToolInvocation,
} from '../../runtime-state';
import { FloatingProfileControls } from '../../components/floating-profile-controls';

const ADDABLE_PROMPT_WORDS = [
  'quiz',
  'game',
  'explainer',
  'elementary',
  'middle school',
  'high school',
  'university',
];

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

type StreamConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting';

type ConversationTimelineItem =
  | {
      kind: 'message';
      key: string;
      message: ChatMessage;
    }
  | {
      kind: 'draft';
      key: string;
      content: string;
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
  const [submitPending, setSubmitPending] = useState(false);
  const [streamConnectionState, setStreamConnectionState] =
    useState<StreamConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const latestEventIdRef = useRef<string | null>(null);
  const handoffAttemptedThreadRef = useRef<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [fullscreenErrorMessage, setFullscreenErrorMessage] = useState<string | null>(null);

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
    setStreamConnectionState('idle');
    setErrorMessage(null);
    setIsPreviewFullscreen(false);
    setFullscreenErrorMessage(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auth bootstrap is keyed to router/session changes.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydration is keyed to the resolved token/thread tuple.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prompt handoff should run once per resolved thread.
  }, [accessToken, thread?.id]);

  const liveRunActive = isRunActive(runtimeState.activeRun);
  const generationInFlight =
    liveRunActive ||
    runtimeState.assistantDraft !== null ||
    runtimeState.activeToolInvocation?.status === 'running';
  const showChatBuildIndicator =
    Boolean(thread?.id) &&
    (runtimeState.sandboxState?.status === 'creating' ||
      runtimeState.activeToolInvocation?.status === 'running');

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) {
      return;
    }

    // Keep the newest message in view as the conversation updates.
    container.scrollTop = container.scrollHeight;
  }, [
    runtimeState.messages.length,
    runtimeState.assistantDraft?.content,
    showChatBuildIndicator,
  ]);

  const conversationTimeline = useMemo<ConversationTimelineItem[]>(() => {
    const items: ConversationTimelineItem[] = runtimeState.messages.map((message) => ({
      kind: 'message',
      key: message.id,
      message,
    }));

    if (runtimeState.assistantDraft) {
      items.push({
        kind: 'draft',
        key: `draft-${runtimeState.assistantDraft.draftId}`,
        content: runtimeState.assistantDraft.content,
      });
    }

    return items;
  }, [runtimeState.messages, runtimeState.assistantDraft]);

  const threadNotice = getThreadNotice({
    streamConnectionState,
    generationInFlight,
    activeRun: runtimeState.activeRun,
  });

  const previewStatus = getPreviewStatus({
    hasExperience: activeExperience !== null,
    activeRun: runtimeState.activeRun,
    activeToolInvocation: runtimeState.activeToolInvocation,
    sandboxState: runtimeState.sandboxState,
    assistantDraftPresent: runtimeState.assistantDraft !== null,
    streamConnectionState,
  });
  const fullscreenSupported = isPreviewFullscreenSupported(
    typeof document === 'undefined' ? null : document,
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    function syncPreviewFullscreenState() {
      const isActive = isPreviewStageFullscreen(
        previewStageRef.current,
        document.fullscreenElement,
      );
      setIsPreviewFullscreen(isActive);

      if (!isActive) {
        setFullscreenErrorMessage(null);
      }
    }

    syncPreviewFullscreenState();
    document.addEventListener('fullscreenchange', syncPreviewFullscreenState);

    return () => {
      document.removeEventListener('fullscreenchange', syncPreviewFullscreenState);
    };
  }, []);

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
    let closedByCleanup = false;

    setStreamConnectionState('connecting');

    const eventTypes = new Set<RuntimeEventData['type']>([
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

        setStreamConnectionState('open');
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

        if (parsed.type === 'run_completed' || parsed.type === 'run_failed') {
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
        if (!closedByCleanup) {
          setStreamConnectionState('reconnecting');
        }
      },
      onerror(error) {
        if (error instanceof FatalStreamAuthError) {
          throw error;
        }
        if (!closedByCleanup) {
          setStreamConnectionState('reconnecting');
        }
        console.error('Runtime event stream error:', error);
      },
    });

    return () => {
      closedByCleanup = true;
      abortController.abort();
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
      assistantDraft: null,
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

    if (!accessToken || submitPending || generationInFlight || !thread?.id) {
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

  function addPromptWord(word: string) {
    setComposerText((previous) => {
      const trimmed = previous.trim();
      if (trimmed.length === 0) {
        return word;
      }

      if (new RegExp(`\\b${word}\\b`, 'i').test(trimmed)) {
        return trimmed;
      }

      return `${trimmed} ${word}`;
    });
  }

  async function submitPrompt(input: {
    prompt: string;
    token: string;
    activeThread: ThreadEnvelope;
    resetComposerOnSuccess: boolean;
  }) {
    if (submitPending) {
      return;
    }

    const trimmed = input.prompt.trim();
    if (trimmed.length === 0) {
      return;
    }

    setErrorMessage(null);
    setSubmitPending(true);
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
        assistantDraft: null,
        activeToolInvocation: null,
      }));

      const response = await apiClientFor(input.token).postJson<SubmitMessageResponse>(
        `/api/chat/threads/${input.activeThread.id}/messages`,
        {
          content: trimmed,
          idempotencyKey: createIdempotencyKey(),
        },
      );

      setRuntimeState((previous) => ({
        ...previous,
        messages: previous.messages.map((message) =>
          message.id === optimisticId ? response.data.message : message,
        ),
        activeRun: response.data.run,
        activeToolInvocation: null,
        assistantDraft: null,
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
      setSubmitPending(false);
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

  async function handleEnterPreviewFullscreen() {
    setFullscreenErrorMessage(null);

    if (typeof document === 'undefined') {
      return;
    }

    if (!fullscreenSupported || typeof previewStageRef.current?.requestFullscreen !== 'function') {
      setFullscreenErrorMessage(
        toPreviewFullscreenErrorMessage('enter', { name: 'NotAllowedError' }),
      );
      return;
    }

    try {
      await previewStageRef.current.requestFullscreen();
    } catch (error) {
      setFullscreenErrorMessage(toPreviewFullscreenErrorMessage('enter', error));
      setIsPreviewFullscreen(false);
    }
  }

  async function handleExitPreviewFullscreen() {
    setFullscreenErrorMessage(null);

    if (typeof document === 'undefined') {
      return;
    }

    if (!document.fullscreenElement) {
      setIsPreviewFullscreen(false);
      return;
    }

    try {
      await document.exitFullscreen();
    } catch (error) {
      setFullscreenErrorMessage(toPreviewFullscreenErrorMessage('exit', error));
    }
  }

  return (
    <div className="page-shell thread-page-shell">
      <FloatingProfileControls onSignOut={() => void handleSignOut()} homeHref="/" />
      <main className="workspace-grid">
        <section className="chat-panel">
          <div ref={chatScrollRef} className="chat-scroll">
            {!threadIdIsValid ? (
              <p className="empty-state">
                This link is invalid. Return home and open another conversation.
              </p>
            ) : !thread?.id && errorMessage ? (
              <p className="error-banner">{errorMessage}</p>
            ) : !thread?.id ? (
              <>
                <div className="chat-loading" aria-hidden="true">
                  <div className="skeleton-line medium" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line short" />
                </div>
                <p className="empty-state">Opening conversation...</p>
              </>
            ) : conversationTimeline.length === 0 ? (
              <p className="empty-state">
                Share your goal and Monti will draft the first creation.
              </p>
            ) : (
              <>
                {conversationTimeline.map((item) =>
                  item.kind === 'message' ? (
                    <article
                      key={item.key}
                      className={`message-row ${item.message.role === 'user' ? 'message-user' : 'message-assistant'}`}
                    >
                      <p className="message-content">{item.message.content}</p>
                    </article>
                  ) : (
                    <article key={item.key} className="message-row message-assistant">
                      <p className="message-content">
                        {item.content}
                        {runtimeState.activeRun?.status === 'failed' ? null : (
                          <span className="draft-cursor" aria-hidden="true" />
                        )}
                      </p>
                    </article>
                  ),
                )}
                {showChatBuildIndicator ? (
                  <article className="message-row message-assistant message-status">
                    <p className="chat-build-indicator" role="status" aria-live="polite">
                      <span className="chat-build-indicator-text">Building experience...</span>
                    </p>
                  </article>
                ) : null}
              </>
            )}
          </div>

          {threadNotice ? (
            <p className="stream-notice" role="status" aria-live="polite">
              {threadNotice}
            </p>
          ) : null}

          <div className="prompt-pill-row" aria-label="Add to prompt">
            {ADDABLE_PROMPT_WORDS.map((word) => (
              <button
                key={word}
                type="button"
                className="prompt-pill"
                disabled={submitPending || !thread?.id || !threadIdIsValid}
                onClick={() => addPromptWord(word)}
              >
                + {word}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="composer-row">
            <input
              value={composerText}
              onChange={(event) => setComposerText(event.target.value)}
              placeholder={
                generationInFlight
                  ? 'Wait for the current reply to finish...'
                  : 'refine'
              }
              disabled={submitPending || !thread?.id || !threadIdIsValid}
            />
            <button
              type="submit"
              className={submitPending || generationInFlight ? 'is-busy' : undefined}
              disabled={
                !accessToken ||
                submitPending ||
                generationInFlight ||
                composerText.trim().length === 0 ||
                !thread?.id ||
                !threadIdIsValid
              }
              aria-label={
                submitPending
                  ? 'Sending prompt'
                  : generationInFlight
                    ? 'Reply in progress'
                    : 'Send prompt'
              }
            >
              {submitPending || generationInFlight ? (
                <LoaderCircle size={18} strokeWidth={2.3} className="composer-spinner" />
              ) : (
                <ArrowUp size={18} strokeWidth={2.6} />
              )}
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
              Reuse last prompt
            </button>
          ) : null}

          {errorMessage && thread?.id ? <p className="error-banner">{errorMessage}</p> : null}
        </section>

        <section className="sandbox-panel">
          <div className="sandbox-header">
            <div className="sandbox-header-copy">
              <h2>{activeExperience ? activeExperience.title : 'Experience'}</h2>
              {fullscreenErrorMessage ? (
                <p className="sandbox-header-note is-error" role="status" aria-live="polite">
                  {fullscreenErrorMessage}
                </p>
              ) : null}
            </div>
            <div className="sandbox-header-actions">
              {activeExperience ? (
                <button
                  type="button"
                  className="sandbox-control-button"
                  onClick={() => void handleEnterPreviewFullscreen()}
                  aria-label="View experience fullscreen"
                  title="View experience fullscreen"
                >
                  <Expand size={17} strokeWidth={2.2} />
                </button>
              ) : null}
            </div>
          </div>

          {activeExperience ? (
            <div
              ref={previewStageRef}
              className={`sandbox-stage${isPreviewFullscreen ? ' is-fullscreen' : ''}`}
            >
              <div className="sandbox-fullscreen-chrome" aria-hidden={!isPreviewFullscreen}>
                <span className="sandbox-fullscreen-hint">Press Esc to exit</span>
                <button
                  type="button"
                  className="sandbox-fullscreen-close"
                  onClick={() => void handleExitPreviewFullscreen()}
                  aria-label="Exit fullscreen preview"
                >
                  <X size={18} strokeWidth={2.35} />
                </button>
              </div>
              <iframe
                title="Monti experience"
                className="sandbox-iframe"
                sandbox="allow-scripts"
                srcDoc={previewDocument}
              />
              {previewStatus?.overlay ? (
                <div className={`sandbox-stage-overlay is-${previewStatus.tone}`}>
                  <span className="loading-spinner" aria-hidden="true" />
                  <div>
                    <strong>{previewStatus.title}</strong>
                    {previewStatus.tone === 'live' ? null : <p>{previewStatus.detail}</p>}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="sandbox-empty">
              {previewStatus ? (
                <div
                  className={`sandbox-loading sandbox-feedback is-${previewStatus.tone}`}
                  role="status"
                  aria-live="polite"
                >
                  <span className="loading-spinner" aria-hidden="true" />
                  <div>
                    <strong>{previewStatus.title}</strong>
                    {previewStatus.tone === 'live' ? null : <p>{previewStatus.detail}</p>}
                  </div>
                </div>
              ) : (
                <p>Your interactive experience appears here after the first draft.</p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function getThreadNotice(input: {
  generationInFlight: boolean;
  streamConnectionState: StreamConnectionState;
  activeRun: AssistantRun | null;
}): string | null {
  if (input.streamConnectionState === 'reconnecting' && input.generationInFlight) {
    return 'Reconnecting to the live reply...';
  }

  if (input.activeRun?.status === 'failed') {
    return 'The last reply stalled. Edit the prompt and try again.';
  }

  return null;
}

function getPreviewStatus(input: {
  hasExperience: boolean;
  activeRun: AssistantRun | null;
  activeToolInvocation: ToolInvocation | null;
  sandboxState: SandboxState | null;
  assistantDraftPresent: boolean;
  streamConnectionState: StreamConnectionState;
}): {
  title: string;
  detail: string;
  tone: 'live' | 'warning' | 'error';
  overlay: boolean;
} | null {
  if (input.streamConnectionState === 'reconnecting' && isRunActive(input.activeRun)) {
    return {
      title: 'Holding the live feed',
      detail: 'Preview updates resume automatically once the event stream reconnects.',
      tone: 'warning',
      overlay: input.hasExperience,
    };
  }

  if (
    input.sandboxState?.status === 'creating' ||
    input.activeToolInvocation?.status === 'running'
  ) {
    return {
      title: input.hasExperience ? 'Refreshing experience' : 'Building experience',
      detail: input.hasExperience
        ? 'Keeping the current experience visible while the next version is prepared.'
        : 'Putting together the first experience.',
      tone: 'live',
      overlay: input.hasExperience,
    };
  }

  if (input.assistantDraftPresent || isRunActive(input.activeRun)) {
    return {
      title: 'Preparing experience',
      detail: input.hasExperience
        ? 'The experience will update after the streaming reply finishes and any tools complete.'
        : 'Working through the request before the experience appears.',
      tone: 'live',
      overlay: false,
    };
  }

  if (input.sandboxState?.status === 'error' || input.activeRun?.status === 'failed') {
    return {
      title: input.hasExperience ? 'Experience needs another pass' : 'Experience paused',
      detail: input.hasExperience
        ? 'The last stable experience is still shown. Retry the prompt when you are ready.'
        : 'The experience did not finish rendering. Retry the prompt to resume.',
      tone: 'error',
      overlay: input.hasExperience,
    };
  }

  return null;
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

  return 'We hit a snag while drafting. Please try again.';
}
