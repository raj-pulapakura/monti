'use client';

import { fetchEventSource } from '@microsoft/fetch-event-source';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toggleExperienceFavourite } from '@/lib/chat/experience-favourite';
import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Expand,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  Star,
  X,
} from 'lucide-react';
import {
  API_BASE_URL,
  createAuthenticatedApiClient,
} from '@/lib/api/authenticated-api-client';
import type { BillingMeResponse } from '@/lib/api/billing-me';
import { consumeHomePromptHandoff } from '@/lib/chat/prompt-handoff';
import { GenerationModeDropdown } from '@/app/components/generation-mode-segmented-control';
import type { GenerationMode } from '@/lib/chat/generation-mode';
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
type RedirectResponse = {
  ok: true;
  data: {
    url?: string;
    checkoutUrl?: string;
  };
};

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
  const [generationMode, setGenerationMode] = useState<GenerationMode>('auto');
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
    if (!accessToken || !threadIdIsValid) {
      return;
    }

    let cancelled = false;
    setBillingLoaded(false);

    void apiClientFor(accessToken)
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

    void apiClientFor(accessToken)
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

    void apiClientFor(accessToken)
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
      const response = await apiClientFor(accessToken).patchJson<UpdateExperienceTitleResponse>(
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

    setGenerationMode(handoff.generationMode);
    void submitPrompt({
      prompt: handoff.prompt,
      generationMode: handoff.generationMode,
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
  const totalAvailableCredits =
    billingData === null
      ? null
      : (billingData.includedCreditsAvailable ?? 0) + (billingData.topupCreditsAvailable ?? 0);
  const costForMode =
    generationMode === 'fast'
      ? billingData?.costs.fastCredits ?? null
      : generationMode === 'quality'
        ? billingData?.costs.qualityCredits ?? null
        : null;
  const softGateActive =
    billingLoaded &&
    Boolean(billingData?.billingEnabled) &&
    typeof totalAvailableCredits === 'number' &&
    typeof costForMode === 'number' &&
    totalAvailableCredits < costForMode;

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

    if (!accessToken || submitPending || generationInFlight || !thread?.id) {
      return;
    }

    const trimmed = composerText.trim();
    if (trimmed.length === 0) {
      return;
    }

    await submitPrompt({
      prompt: trimmed,
      generationMode,
      token: accessToken,
      activeThread: thread,
      resetComposerOnSuccess: true,
    });
  }

  async function submitPrompt(input: {
    prompt: string;
    generationMode?: GenerationMode;
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
        contentJson:
          input.generationMode && input.generationMode !== 'auto'
            ? {
                generationMode: input.generationMode,
              }
            : null,
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
          generationMode:
            input.generationMode && input.generationMode !== 'auto'
              ? input.generationMode
              : undefined,
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

  async function handleBuyTopup() {
    if (!accessToken || billingActionPending) {
      return;
    }
    setBillingActionPending(true);
    setErrorMessage(null);
    try {
      const response = await apiClientFor(accessToken).postJson<RedirectResponse>(
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

          {suggestions.length > 0 ? (
            <div className="prompt-pill-row" aria-label="Suggested refinements">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  className="prompt-pill"
                  disabled={submitPending || !thread?.id || !threadIdIsValid}
                  onClick={() => setComposerText(suggestion.prompt)}
                >
                  <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
                  {suggestion.label}
                </button>
              ))}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="composer-row">
            <div className="composer-input-shell">
              <input
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                placeholder={
                  generationInFlight
                    ? 'Wait for the current reply to finish...'
                    : 'Send a message...'
                }
                disabled={submitPending || !thread?.id || !threadIdIsValid}
              />
              <div className="composer-actions">
                {billingData?.billingEnabled && typeof costForMode === 'number' ? (
                  <span className="composer-credit-cost" aria-live="polite">
                    {costForMode} cr
                  </span>
                ) : null}
                <GenerationModeDropdown
                  value={generationMode}
                  onChange={setGenerationMode}
                  disabled={submitPending || !thread?.id || !threadIdIsValid}
                />
                <button
                  type="submit"
                  className={`home-create-submit ${submitPending || generationInFlight ? 'is-busy' : ''}`}
                  disabled={
                    !accessToken ||
                    submitPending ||
                    generationInFlight ||
                    softGateActive ||
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
                    <ArrowUp size={20} strokeWidth={2.4} />
                  )}
                </button>
              </div>
            </div>
          </form>

          {softGateActive ? (
            <p className="stream-notice" role="status" aria-live="polite">
              {billingData?.plan === 'paid' ? (
                <>
                  You do not have enough credits for this mode.
                  <button
                    type="button"
                    className="inline-link-button"
                    onClick={() => void handleBuyTopup()}
                    disabled={billingActionPending}
                  >
                    {billingActionPending ? ' Opening checkout...' : ' Buy top-up'}
                  </button>
                  .
                </>
              ) : (
                <>
                  You do not have enough credits for this mode.{' '}
                  <a href="/billing">Upgrade in billing</a>.
                </>
              )}
            </p>
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
          <div className="sandbox-header">
            <div className="sandbox-header-copy">
              {activeExperience ? (
                <div
                  className={
                    isEditingTitle ? 'sandbox-title-row sandbox-title-row--edit' : 'sandbox-title-row'
                  }
                >
                  {isEditingTitle ? (
                    <>
                      <input
                        ref={titleInputRef}
                        className="sandbox-title-input"
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleTitleSave();
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            handleTitleCancel();
                          }
                        }}
                        disabled={titleEditPending}
                        aria-label="Edit experience title"
                      />
                      <div className="sandbox-title-edit-actions">
                        <button
                          type="button"
                          className="sandbox-title-icon-action"
                          onClick={() => void handleTitleSave()}
                          disabled={titleEditPending || titleDraft.trim().length === 0}
                          aria-label="Save title"
                          title="Save title"
                        >
                          <Check size={16} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="sandbox-title-icon-action"
                          onClick={() => handleTitleCancel()}
                          disabled={titleEditPending}
                          aria-label="Cancel title edit"
                          title="Cancel"
                        >
                          <X size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="sandbox-title-heading">{activeExperience.title}</h2>
                      <button
                        type="button"
                        className="sandbox-title-icon-action"
                        onClick={() => {
                          setTitleDraft(activeExperience.title);
                          setTitleEditError(null);
                          setIsEditingTitle(true);
                        }}
                        aria-label="Edit experience title"
                        title="Edit title"
                      >
                        <Pencil size={15} strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <h2>Experience</h2>
              )}
              {titleEditError ? (
                <p className="sandbox-header-note is-error" role="status" aria-live="polite">
                  {titleEditError}
                </p>
              ) : null}
              {fullscreenErrorMessage ? (
                <p className="sandbox-header-note is-error" role="status" aria-live="polite">
                  {fullscreenErrorMessage}
                </p>
              ) : null}
              {favouriteActionError ? (
                <p className="sandbox-header-note is-error" role="status" aria-live="polite">
                  {favouriteActionError}
                </p>
              ) : null}
            </div>
            <div className="sandbox-header-actions">
              {versionList.length > 1 && viewingVersionNumber !== null ? (
                <div
                  className="sandbox-version-nav"
                  aria-label="Version navigation"
                  title={versionList[viewingVersionIndex]?.promptSummary ?? ''}
                >
                  <button
                    type="button"
                    className="sandbox-version-chevron"
                    disabled={viewingVersionIndex <= 0}
                    onClick={() => {
                      if (viewingVersionIndex > 0) {
                        setViewingVersionId(versionList[viewingVersionIndex - 1].id);
                      }
                    }}
                    aria-label="Previous version"
                  >
                    <ChevronLeft size={13} strokeWidth={2.5} />
                  </button>
                  <span className="sandbox-version-label">
                    v{viewingVersionNumber} <span className="sandbox-version-total">/ {versionList.length}</span>
                  </span>
                  <button
                    type="button"
                    className="sandbox-version-chevron"
                    disabled={viewingVersionIndex >= versionList.length - 1}
                    onClick={() => {
                      if (viewingVersionIndex < versionList.length - 1) {
                        setViewingVersionId(versionList[viewingVersionIndex + 1].id);
                      }
                    }}
                    aria-label="Next version"
                  >
                    <ChevronRight size={13} strokeWidth={2.5} />
                  </button>
                </div>
              ) : null}
              {activeExperience ? (
                <button
                  type="button"
                  className={`sandbox-control-button${activeExperience.isFavourite ? ' is-favourited-star' : ''}`}
                  onClick={() => void handleSandboxFavouriteToggle()}
                  disabled={favouriteTogglePending}
                  aria-label={
                    activeExperience.isFavourite
                      ? 'Remove from favourites'
                      : 'Add to favourites'
                  }
                  title={
                    activeExperience.isFavourite
                      ? 'Remove from favourites'
                      : 'Add to favourites'
                  }
                >
                  <Star size={17} strokeWidth={2.2} />
                </button>
              ) : null}
              {activeExperience?.slug ? (
                <button
                  type="button"
                  className="sandbox-control-button"
                  onClick={() => void handleCopyLink()}
                  aria-label={
                    linkCopied
                      ? 'Link copied'
                      : !isViewingLatest && viewingVersionNumber !== null
                        ? `Copy link to v${viewingVersionNumber}`
                        : 'Copy link'
                  }
                  title={
                    linkCopied
                      ? 'Link copied!'
                      : !isViewingLatest && viewingVersionNumber !== null
                        ? `Copy link to v${viewingVersionNumber}`
                        : 'Copy link'
                  }
                >
                  {linkCopied ? (
                    <Check size={17} strokeWidth={2.2} />
                  ) : (
                    <Link2 size={17} strokeWidth={2.2} />
                  )}
                </button>
              ) : null}
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
