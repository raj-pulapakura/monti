'use client';

import { fetchEventSource } from '@microsoft/fetch-event-source';
import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { appendSuggestionToComposer } from '@/lib/chat/append-suggestion-to-composer';
import { toggleExperienceFavourite } from '@/lib/chat/experience-favourite';
import {
  API_BASE_URL,
  createAuthenticatedApiClient,
} from '@/lib/api/authenticated-api-client';
import type { BillingMeResponse } from '@/lib/api/billing-me';
import { consumeHomePromptHandoff } from '@/lib/chat/prompt-handoff';
import { consumeThreadBootstrap } from '@/lib/chat/thread-bootstrap';
import type { GenerationMode } from '@/lib/chat/generation-mode';
// X is still used for the fullscreen close button
import { X } from 'lucide-react';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { toErrorMessage } from '@/lib/errors';
import { submitFeedback } from '@/lib/feedback/submit-feedback';
import { buildSrcdoc } from '@/lib/preview';
import type { RedirectResponse } from '@/lib/api/types';
import {
  isPreviewFullscreenSupported,
  isPreviewStageFullscreen,
  toPreviewFullscreenErrorMessage,
} from './fullscreen-preview';
import {
  getRetryComposerValue,
  INITIAL_RUNTIME_STATE,
  isRunActive,
  isUserFacingChatMessage,
  mergeHydratedMessagesWithOptimistic,
  mergeSandboxStateByRecency,
  reconcileHydrationState,
  reduceRuntimeEvent,
  type AssistantRun,
  type ChatMessage,
  type RuntimeEventData,
  type RuntimeState,
  type SandboxState,
  type ToolInvocation,
} from '../../runtime-state';
import { ConfirmModal } from '../../components/confirm-modal';
import { AppTopbar } from '../../components/app-topbar';
import { ChatComposer } from './components/chat-composer';
import { ConfirmationGate } from './components/confirmation-gate';
import { SuggestionChips } from './components/suggestion-chips';
import { SandboxHeader } from './components/sandbox-header';
import { ConversationTimeline } from './components/conversation-timeline';
import { isBalanceSufficientForMinimumTier } from '@/lib/billing/is-balance-sufficient-for-mode';
import { BillingGate } from '@/app/components/billing-gate';
import { useCreditsBalance } from '@/app/context/credits-balance-context';

type RefinementSuggestion = {
  label: string;
  prompt: string;
};

type RefinementSuggestionsResponse = {
  ok: true;
  data: {
    suggestions: RefinementSuggestion[];
  };
};

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
  slug: string | null;
  isFavourite: boolean;
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

type VersionMeta = {
  id: string;
  versionNumber: number;
  promptSummary: string;
};

type VersionContentResponse = {
  ok: true;
  data: {
    html: string;
    css: string;
    js: string;
  };
};

type UpdateExperienceTitleResponse = {
  ok: true;
  data: {
    title: string;
  };
};

type SandboxPreviewResponse = {
  ok: true;
  data: {
    sandboxState: SandboxState;
    activeExperience: ExperiencePayload | null;
    allVersions: VersionMeta[];
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
  const getSupabaseClient = useSupabaseClient();
  const { refreshCredits } = useCreditsBalance();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadEnvelope | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>(INITIAL_RUNTIME_STATE);
  const [activeExperience, setActiveExperience] = useState<ExperiencePayload | null>(null);
  const [composerText, setComposerText] = useState('');
  const [submitPending, setSubmitPending] = useState(false);
  const [streamConnectionState, setStreamConnectionState] =
    useState<StreamConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmRunPending, setConfirmRunPending] = useState(false);
  const [cancelRunPending, setCancelRunPending] = useState(false);
  /** Hide the gate immediately after Confirm/Cancel; cleared when the run leaves `awaiting_confirmation`. */
  const [confirmationGateDismissedRunId, setConfirmationGateDismissedRunId] = useState<string | null>(null);
  const latestEventIdRef = useRef<string | null>(null);
  const handoffAttemptedThreadRef = useRef<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [fullscreenErrorMessage, setFullscreenErrorMessage] = useState<string | null>(null);
  const [billingData, setBillingData] = useState<BillingMeResponse['data'] | null>(null);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [billingActionPending, setBillingActionPending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [suggestions, setSuggestions] = useState<RefinementSuggestion[]>([]);
  const latestSuggestionVersionRef = useRef<string | null>(null);
  const [versionList, setVersionList] = useState<VersionMeta[]>([]);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleEditError, setTitleEditError] = useState<string | null>(null);
  const [titleEditPending, setTitleEditPending] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [favouriteTogglePending, setFavouriteTogglePending] = useState(false);
  const [favouriteActionError, setFavouriteActionError] = useState<string | null>(null);
  const [sandboxDeleteConfirmOpen, setSandboxDeleteConfirmOpen] = useState(false);
  const [sandboxDeletePending, setSandboxDeletePending] = useState(false);

  useEffect(() => {
    latestEventIdRef.current = runtimeState.latestEventId;
  }, [runtimeState.latestEventId]);

  // Runs synchronously after DOM updates, before the browser paints — avoids a one-frame
  // skeleton flash when sessionStorage has a thread bootstrap (new chat from home).
  useLayoutEffect(() => {
    latestEventIdRef.current = null;
    setRuntimeState(INITIAL_RUNTIME_STATE);
    setActiveExperience(null);
    setStreamConnectionState('idle');
    setErrorMessage(null);
    setIsPreviewFullscreen(false);
    setFullscreenErrorMessage(null);
    setBillingData(null);
    setBillingLoaded(false);
    setBillingActionPending(false);
    setLinkCopied(false);
    setSuggestions([]);
    latestSuggestionVersionRef.current = null;
    setVersionList([]);
    setViewingVersionId(null);
    setNewVersionAvailable(false);
    setIsEditingTitle(false);
    setTitleDraft('');
    setTitleEditError(null);
    setTitleEditPending(false);
    handoffAttemptedThreadRef.current = null;
    setConfirmRunPending(false);
    setCancelRunPending(false);
    setConfirmationGateDismissedRunId(null);

    if (isUuidLike(routeThreadId)) {
      const bootstrap = consumeThreadBootstrap(routeThreadId);
      setThread(bootstrap ?? null);
    } else {
      setThread(null);
    }
  }, [routeThreadId]);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(activeExperience?.title ?? '');
      setTitleEditError(null);
    }
  }, [activeExperience?.title, isEditingTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const { client: supabaseClient, error: clientError } = getSupabaseClient();
    if (!supabaseClient) {
      setErrorMessage(clientError ?? 'Supabase authentication is not configured.');
      return;
    }

    void syncSession(supabaseClient);

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);
      if (!token) {
        setThread(null);
        setRuntimeState(INITIAL_RUNTIME_STATE);
        router.replace('/sign-in');
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
    if (!accessToken || !threadIdIsValid) {
      return;
    }

    let cancelled = false;
    setBillingLoaded(false);

    void createAuthenticatedApiClient(accessToken)
      .getJson<BillingMeResponse>('/api/billing/me')
      .then((response) => {
        if (cancelled) {
          return;
        }
        setBillingData(response.data);
        setBillingLoaded(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        // Billing failures on chat are intentionally non-blocking.
        setBillingData(null);
        setBillingLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, routeThreadId, threadIdIsValid]);

  const activeExperienceVersionId = runtimeState.sandboxState?.experienceVersionId ?? null;

  const viewingVersionIndex = viewingVersionId
    ? versionList.findIndex((v) => v.id === viewingVersionId)
    : versionList.findIndex((v) => v.id === activeExperienceVersionId);
  const viewingVersionNumber =
    viewingVersionIndex >= 0 ? versionList[viewingVersionIndex].versionNumber : null;
  const latestVersionId = versionList[versionList.length - 1]?.id ?? null;
  const isViewingLatest = viewingVersionId === null || viewingVersionId === latestVersionId;

  useEffect(() => {
    if (!accessToken || !thread?.id || !activeExperienceVersionId) {
      return;
    }

    if (latestSuggestionVersionRef.current === activeExperienceVersionId) {
      return;
    }

    const versionId = activeExperienceVersionId;
    latestSuggestionVersionRef.current = versionId;

    void createAuthenticatedApiClient(accessToken)
      .getJson<RefinementSuggestionsResponse>(
        `/api/chat/threads/${thread.id}/refinement-suggestions?experienceVersionId=${versionId}`,
      )
      .then((response) => {
        // Ignore stale responses if a newer version has since arrived
        if (latestSuggestionVersionRef.current !== versionId) {
          return;
        }
        setSuggestions(response.data.suggestions);
      })
      .catch(() => {
        // Suggestions are non-blocking; fail silently
        if (latestSuggestionVersionRef.current === versionId) {
          setSuggestions([]);
        }
      });
  }, [accessToken, thread?.id, activeExperienceVersionId]);

  const prevActiveExperienceVersionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevActiveExperienceVersionIdRef.current;
    prevActiveExperienceVersionIdRef.current = activeExperienceVersionId;

    if (
      viewingVersionId !== null &&
      activeExperienceVersionId !== null &&
      prev !== null &&
      activeExperienceVersionId !== prev
    ) {
      setNewVersionAvailable(true);
    }
  }, [activeExperienceVersionId, viewingVersionId]);

  useEffect(() => {
    if (!accessToken || !thread?.id || viewingVersionId === null) {
      return;
    }

    const targetVersionId = viewingVersionId;

    void createAuthenticatedApiClient(accessToken)
      .getJson<VersionContentResponse>(
        `/api/chat/threads/${thread.id}/experience-versions/${targetVersionId}`,
      )
      .then((response) => {
        if (viewingVersionId !== targetVersionId) {
          return;
        }
        setActiveExperience((prev) =>
          prev
            ? {
                ...prev,
                html: response.data.html,
                css: response.data.css,
                js: response.data.js,
              }
            : null,
        );
      })
      .catch(() => {
        // Version content fetch failed — stay on current view silently
      });
  }, [accessToken, thread?.id, viewingVersionId]);

  async function handleTitleSave() {
    if (!accessToken || !thread?.id || !activeExperience || titleEditPending) {
      return;
    }

    const trimmed = titleDraft.trim();
    if (trimmed.length === 0) {
      setTitleEditError('Title must not be empty.');
      return;
    }

    setTitleEditError(null);
    setTitleEditPending(true);
    const previousTitle = activeExperience.title;

    setActiveExperience((prev) => (prev ? { ...prev, title: trimmed } : prev));

    try {
      const response = await createAuthenticatedApiClient(accessToken).patchJson<UpdateExperienceTitleResponse>(
        `/api/chat/threads/${thread.id}/title`,
        { title: trimmed },
      );
      setActiveExperience((prev) =>
        prev ? { ...prev, title: response.data.title } : prev,
      );
      setIsEditingTitle(false);
    } catch (error) {
      setActiveExperience((prev) =>
        prev ? { ...prev, title: previousTitle } : prev,
      );
      setTitleDraft(previousTitle);
      setTitleEditError(toErrorMessage(error));
    } finally {
      setTitleEditPending(false);
    }
  }

  function handleTitleCancel() {
    setIsEditingTitle(false);
    setTitleDraft(activeExperience?.title ?? '');
    setTitleEditError(null);
  }

  useEffect(() => {
    if (!accessToken || !thread?.id) {
      return;
    }

    if (handoffAttemptedThreadRef.current === thread.id) {
      return;
    }
    handoffAttemptedThreadRef.current = thread.id;

    const handoff = consumeHomePromptHandoff(thread.id);
    if (!handoff) {
      return;
    }

    void submitPrompt({
      prompt: handoff.prompt,
      token: accessToken,
      activeThread: thread,
      resetComposerOnSuccess: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prompt handoff should run once per resolved thread.
  }, [accessToken, thread?.id]);

  const serverAwaitingConfirmation = runtimeState.activeRun?.status === 'awaiting_confirmation';
  const confirmationGateVisible =
    Boolean(
      serverAwaitingConfirmation &&
        runtimeState.activeRun?.confirmationMetadata &&
        runtimeState.activeRun.id !== confirmationGateDismissedRunId,
    );
  const liveRunActive = isRunActive(runtimeState.activeRun);
  const generationInFlight =
    (liveRunActive && !serverAwaitingConfirmation) ||
    (Boolean(runtimeState.activeRun?.id) &&
      serverAwaitingConfirmation &&
      confirmationGateDismissedRunId === runtimeState.activeRun?.id) ||
    (runtimeState.assistantDraft !== null && liveRunActive) ||
    (runtimeState.activeToolInvocation?.status === 'running' && liveRunActive);
  // The model sometimes issues a second `generate_experience` after the closing reply.
  // Sandbox is already `ready` then — do not treat running tool state as a new "build".
  const sandboxAlreadyReady = runtimeState.sandboxState?.status === 'ready';
  const showChatBuildIndicator =
    Boolean(thread?.id) &&
    (runtimeState.sandboxState?.status === 'creating' ||
      (!sandboxAlreadyReady &&
        runtimeState.activeToolInvocation?.status === 'running' &&
        runtimeState.activeToolInvocation.toolName === 'generate_experience'));
  const showThinkingIndicator =
    Boolean(thread?.id) &&
    liveRunActive &&
    runtimeState.assistantDraft === null &&
    !showChatBuildIndicator;

  useEffect(() => {
    if (runtimeState.activeRun?.status !== 'awaiting_confirmation') {
      setConfirmationGateDismissedRunId(null);
    }
  }, [runtimeState.activeRun?.status]);

  // SSE replay can briefly resurrect a draft or "running" tool after hydration already
  // reflected a terminal run (truncated in-memory buffer / ordering). Drop those artefacts.
  useEffect(() => {
    const run = runtimeState.activeRun;
    const status = run?.status ?? null;

    const invocation = runtimeState.activeToolInvocation;
    const orphanBusyTool =
      invocation !== null &&
      (invocation.status === 'running' || invocation.status === 'pending') &&
      !isRunActive(run);

    const staleLiveDraft =
      runtimeState.assistantDraft !== null &&
      (run === null || status === 'succeeded' || status === 'cancelled');

    if (!orphanBusyTool && !staleLiveDraft) {
      return;
    }

    setRuntimeState((prev) => ({
      ...prev,
      ...(staleLiveDraft ? { assistantDraft: null } : {}),
      ...(orphanBusyTool ? { activeToolInvocation: null } : {}),
    }));
  }, [
    runtimeState.activeRun?.id,
    runtimeState.activeRun?.status,
    runtimeState.assistantDraft?.draftId,
    runtimeState.activeToolInvocation?.id,
    runtimeState.activeToolInvocation?.status,
  ]);

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
    showThinkingIndicator,
  ]);

  const conversationTimeline = useMemo<ConversationTimelineItem[]>(() => {
    const items: ConversationTimelineItem[] = runtimeState.messages
      .filter(isUserFacingChatMessage)
      .map((message) => ({
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

  const handleMessageFeedback = useCallback(
    async (
      messageId: string,
      kind: 'thumbs_up' | 'thumbs_down',
      message: string | null,
    ) => {
      if (!accessToken || !thread?.id) {
        return;
      }
      const experienceId = runtimeState.sandboxState?.experienceId ?? undefined;
      await submitFeedback(accessToken, {
        kind,
        message,
        thread_id: thread.id,
        message_id: messageId,
        ...(experienceId ? { experience_id: experienceId } : {}),
      });
    },
    [accessToken, thread?.id, runtimeState.sandboxState?.experienceId],
  );

  const threadNotice = getThreadNotice({
    streamConnectionState,
    generationInFlight,
    activeRun: runtimeState.activeRun,
  });

  const isBuilding = showChatBuildIndicator;
  const [buildElapsedSeconds, setBuildElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isBuilding) {
      setBuildElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const tick = () => {
      setBuildElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isBuilding]);

  const fullscreenSupported = isPreviewFullscreenSupported(
    typeof document === 'undefined' ? null : document,
  );
  const balanceSufficient =
    billingData === null || !billingLoaded
      ? true
      : isBalanceSufficientForMinimumTier(billingData);
  const softGateActive =
    billingLoaded && Boolean(billingData?.billingEnabled) && !balanceSufficient;

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
      'confirmation_required',
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
          const { client: supabaseClient } = getSupabaseClient();
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
          void refreshSandboxPreview(thread.id, accessToken);
          void refreshCredits().then((data) => {
            if (data) {
              setBillingData(data);
            }
          });
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
  }, [thread?.id, accessToken, refreshCredits]);

  const previewDocument = useMemo(() => {
    if (!activeExperience) {
      return '';
    }

    return buildSrcdoc(activeExperience.html, activeExperience.css, activeExperience.js);
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
      router.replace('/sign-in');
    }
  }

  async function hydrateAndSetThreadState(threadId: string, token: string) {
    const hydrated = await fetchThreadHydration(threadId, token);

    setThread(hydrated.thread);
    setRuntimeState((previous) => {
      const preserveEventCursor =
        previous.messages.length > 0 ||
        previous.activeRun != null ||
        previous.activeToolInvocation != null ||
        previous.assistantDraft != null;
      return {
        ...previous,
        messages: mergeHydratedMessagesWithOptimistic(previous.messages, hydrated.messages),
        activeRun: hydrated.activeRun,
        activeToolInvocation: hydrated.activeToolInvocation,
        sandboxState: mergeSandboxStateByRecency(previous.sandboxState, hydrated.sandboxState),
        assistantDraft: null,
        latestEventId:
          hydrated.latestEventId != null
            ? hydrated.latestEventId
            : preserveEventCursor
              ? previous.latestEventId
              : null,
      };
    });

    await refreshSandboxPreview(hydrated.thread.id, token);
    return hydrated.thread;
  }

  async function refreshThreadSnapshot(threadId: string, token: string) {
    const hydrated = await fetchThreadHydration(threadId, token);
    setThread(hydrated.thread);
    setRuntimeState((previous) => reconcileHydrationState(previous, hydrated));
  }

  async function handleConfirmationConfirm(mode: GenerationMode) {
    if (!accessToken || !thread?.id || !runtimeState.activeRun?.id) {
      return;
    }
    if (runtimeState.activeRun.status !== 'awaiting_confirmation') {
      return;
    }
    const runId = runtimeState.activeRun.id;
    setConfirmationGateDismissedRunId(runId);
    setConfirmRunPending(true);
    setErrorMessage(null);
    try {
      await createAuthenticatedApiClient(accessToken).postJson<{ ok: true }>(
        `/api/chat/threads/${thread.id}/runs/${runId}/confirm`,
        { decision: 'confirmed', qualityMode: mode },
      );
      await refreshThreadSnapshot(thread.id, accessToken);
    } catch (error) {
      setConfirmationGateDismissedRunId(null);
      setErrorMessage(toErrorMessage(error));
      await refreshThreadSnapshot(thread.id, accessToken);
    } finally {
      setConfirmRunPending(false);
    }
  }

  async function handleConfirmationCancel() {
    if (!accessToken || !thread?.id || !runtimeState.activeRun?.id) {
      return;
    }
    if (runtimeState.activeRun.status !== 'awaiting_confirmation') {
      return;
    }
    const runId = runtimeState.activeRun.id;
    setConfirmationGateDismissedRunId(runId);
    setCancelRunPending(true);
    setErrorMessage(null);
    try {
      await createAuthenticatedApiClient(accessToken).postJson<{ ok: true }>(
        `/api/chat/threads/${thread.id}/runs/${runId}/confirm`,
        { decision: 'cancelled' },
      );
      await refreshThreadSnapshot(thread.id, accessToken);
    } catch (error) {
      setConfirmationGateDismissedRunId(null);
      setErrorMessage(toErrorMessage(error));
      await refreshThreadSnapshot(thread.id, accessToken);
    } finally {
      setCancelRunPending(false);
    }
  }

  async function refreshSandboxPreview(threadId: string, token: string) {
    const response = await createAuthenticatedApiClient(token).getJson<SandboxPreviewResponse>(
      `/api/chat/threads/${threadId}/sandbox`,
    );

    setRuntimeState((previous) => ({
      ...previous,
      sandboxState: mergeSandboxStateByRecency(previous.sandboxState, response.data.sandboxState),
    }));
    const nextExperience = response.data.activeExperience;
    setActiveExperience(
      nextExperience
        ? {
            ...nextExperience,
            isFavourite: nextExperience.isFavourite ?? false,
          }
        : null,
    );
    setVersionList(response.data.allVersions ?? []);
  }

  async function handleSandboxFavouriteToggle() {
    if (
      !accessToken ||
      !thread?.id ||
      !activeExperience ||
      favouriteTogglePending
    ) {
      return;
    }

    const next = !activeExperience.isFavourite;
    const previous = activeExperience.isFavourite;

    setFavouriteActionError(null);
    setActiveExperience({ ...activeExperience, isFavourite: next });
    setFavouriteTogglePending(true);

    try {
      await toggleExperienceFavourite(accessToken, thread.id, next);
    } catch (error) {
      setActiveExperience({ ...activeExperience, isFavourite: previous });
      setFavouriteActionError(toErrorMessage(error));
    } finally {
      setFavouriteTogglePending(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!accessToken || submitPending || generationInFlight || serverAwaitingConfirmation || !thread?.id) {
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
    if (submitPending) {
      return;
    }

    const trimmed = input.prompt.trim();
    if (trimmed.length === 0) {
      return;
    }

    setViewingVersionId(null);
    setNewVersionAvailable(false);
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

      const response = await createAuthenticatedApiClient(input.token).postJson<SubmitMessageResponse>(
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
    const { client: supabaseClient } = getSupabaseClient();
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

  async function handleCopyLink() {
    if (!activeExperience?.slug) {
      return;
    }

    const base = `${window.location.origin}/play/${activeExperience.slug}`;
    const url =
      !isViewingLatest && viewingVersionNumber !== null
        ? `${base}?v=${viewingVersionNumber}`
        : base;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleSandboxDeleteConfirm() {
    if (!accessToken || !thread?.id || sandboxDeletePending) {
      return;
    }

    setSandboxDeletePending(true);
    try {
      await createAuthenticatedApiClient(accessToken).deleteJson<{ ok: true }>(
        `/api/chat/threads/${thread.id}`,
      );
      router.replace('/');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
      setSandboxDeleteConfirmOpen(false);
    } finally {
      setSandboxDeletePending(false);
    }
  }

  async function handleBuyTopup() {
    if (!accessToken || billingActionPending) {
      return;
    }
    setBillingActionPending(true);
    setErrorMessage(null);
    try {
      const response = await createAuthenticatedApiClient(accessToken).postJson<RedirectResponse>(
        '/api/billing/checkout/topup',
        {},
      );
      const destination = response.data.checkoutUrl ?? response.data.url;
      if (!destination) {
        throw new Error('No checkout URL returned by the server.');
      }
      window.location.href = destination;
    } catch (error) {
      setBillingActionPending(false);
      setErrorMessage(toErrorMessage(error));
    }
  }

  return (
    <div className="page-shell thread-page-shell">
      <AppTopbar onSignOut={() => void handleSignOut()} />
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
              <div className="chat-loading" aria-hidden="true">
                <div className="skeleton-line medium" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            ) : conversationTimeline.length === 0 &&
              !submitPending &&
              !generationInFlight ? (
              <p className="empty-state">
                Share your goal and Monti will draft the first creation.
              </p>
            ) : (
              <ConversationTimeline
                items={conversationTimeline}
                activeRunStatus={runtimeState.activeRun?.status ?? null}
                showThinkingIndicator={showThinkingIndicator}
                showBuildIndicator={showChatBuildIndicator}
                onMessageFeedback={
                  accessToken && thread?.id ? handleMessageFeedback : undefined
                }
              />
            )}
          </div>

          {threadNotice ? (
            <p className="stream-notice" role="status" aria-live="polite">
              {threadNotice}
            </p>
          ) : null}

          <SuggestionChips
            suggestions={suggestions}
            disabled={submitPending || serverAwaitingConfirmation || !thread?.id || !threadIdIsValid}
            onSelect={(prompt) =>
              setComposerText((previous) => appendSuggestionToComposer(previous, prompt))
            }
          />

          {confirmationGateVisible &&
          runtimeState.activeRun?.confirmationMetadata &&
          runtimeState.activeRun ? (
            <ConfirmationGate
              operation={runtimeState.activeRun.confirmationMetadata.operation}
              estimatedCredits={runtimeState.activeRun.confirmationMetadata.estimatedCredits}
              confirmPending={confirmRunPending}
              cancelPending={cancelRunPending}
              onConfirm={(mode) => void handleConfirmationConfirm(mode)}
              onCancel={() => void handleConfirmationCancel()}
            />
          ) : null}

          <ChatComposer
            value={composerText}
            onChange={setComposerText}
            onSubmit={handleSubmit}
            generationInFlight={generationInFlight}
            submitPending={submitPending}
            disabled={
              !accessToken ||
              submitPending ||
              generationInFlight ||
              serverAwaitingConfirmation ||
              !thread?.id ||
              !threadIdIsValid
            }
            softGateActive={softGateActive}
          />

          {softGateActive && billingData ? (
            <BillingGate
              plan={billingData.plan}
              billingActionPending={billingActionPending}
              onBuyTopup={() => void handleBuyTopup()}
            />
          ) : null}

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
          <SandboxHeader
            activeExperience={activeExperience}
            versionList={versionList}
            viewingVersionIndex={viewingVersionIndex}
            viewingVersionNumber={viewingVersionNumber}
            isEditingTitle={isEditingTitle}
            titleDraft={titleDraft}
            titleEditPending={titleEditPending}
            titleEditError={titleEditError}
            fullscreenErrorMessage={fullscreenErrorMessage}
            favouriteActionError={favouriteActionError}
            favouriteTogglePending={favouriteTogglePending}
            linkCopied={linkCopied}
            isViewingLatest={isViewingLatest}
            onTitleDraftChange={setTitleDraft}
            onTitleSave={() => void handleTitleSave()}
            onTitleCancel={handleTitleCancel}
            onEditTitleStart={() => {
              setTitleDraft(activeExperience?.title ?? '');
              setTitleEditError(null);
              setIsEditingTitle(true);
            }}
            onVersionPrev={() => {
              if (viewingVersionIndex > 0) {
                setViewingVersionId(versionList[viewingVersionIndex - 1].id);
              }
            }}
            onVersionNext={() => {
              if (viewingVersionIndex < versionList.length - 1) {
                setViewingVersionId(versionList[viewingVersionIndex + 1].id);
              }
            }}
            onFavouriteToggle={() => void handleSandboxFavouriteToggle()}
            onDelete={() => setSandboxDeleteConfirmOpen(true)}
            isDeletePending={sandboxDeletePending}
            onCopyLink={() => void handleCopyLink()}
            onEnterFullscreen={() => void handleEnterPreviewFullscreen()}
          />

          {newVersionAvailable ? (
            <button
              type="button"
              className="sandbox-new-version-nudge"
              onClick={() => {
                setViewingVersionId(null);
                setNewVersionAvailable(false);
              }}
            >
              New version available — view latest
            </button>
          ) : null}

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
            </div>
          ) : (
            <div className="sandbox-empty">
              <p>Your interactive experience appears here after the first draft.</p>
            </div>
          )}

          <div className="sandbox-status-bar">
            <div className="sandbox-status-main" role="status" aria-live="polite">
              {isBuilding ? (
                <>
                  <span className="loading-spinner" aria-hidden="true" />
                  <span className="sandbox-status-label">Building…</span>
                </>
              ) : activeExperience ? (
                <>
                  <span className="sandbox-status-ready-dot" aria-hidden="true" />
                  <span className="sandbox-status-label">Ready</span>
                </>
              ) : (
                <span className="sandbox-status-label">No experience yet</span>
              )}
            </div>
            {isBuilding ? (
              <span className="sandbox-status-elapsed" aria-hidden="true">
                {formatSandboxBuildElapsed(buildElapsedSeconds)}
              </span>
            ) : null}
          </div>
        </section>
      </main>

      {sandboxDeleteConfirmOpen ? (
        <ConfirmModal
          title="Delete this creation?"
          message="It will be removed from your library. This action cannot be undone."
          confirmLabel="Delete"
          isPending={sandboxDeletePending}
          onConfirm={() => void handleSandboxDeleteConfirm()}
          onCancel={() => {
            if (!sandboxDeletePending) {
              setSandboxDeleteConfirmOpen(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function formatSandboxBuildElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
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
  const response = await createAuthenticatedApiClient(token).getJson<ThreadHydrationResponse>(
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



