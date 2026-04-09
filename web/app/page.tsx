"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthenticatedApiClient } from "@/lib/api/authenticated-api-client";
import type { BillingMeResponse } from "@/lib/api/billing-me";
import { writeHomePromptHandoff } from "@/lib/chat/prompt-handoff";
import {
  generationModeMenuLabel,
  type GenerationMode,
} from "@/lib/chat/generation-mode";
import { useSupabaseClient } from "./hooks/use-supabase-client";
import { toErrorMessage } from "@/lib/errors";
import { FloatingProfileControls } from "./components/floating-profile-controls";
import { GenerationModeDropdown } from "./components/generation-mode-segmented-control";
import { MarketingLanding } from "./components/marketing-landing";
import { BillingStrip } from "./components/billing-strip";
import { CreationCard } from "./components/creation-card";
import {
  examplePromptChipLabel,
  pickHomeExamplePrompts,
} from "@/lib/home-example-prompts";
import { toggleExperienceFavourite } from "@/lib/chat/experience-favourite";
import { ArrowUp, LoaderCircle, Search, Star } from "lucide-react";

type ThreadCard = {
  id: string;
  userId: string;
  title: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sandboxStatus: "empty" | "creating" | "ready" | "error" | null;
  sandboxUpdatedAt: string | null;
  /** API may omit keys; treat missing/undefined like no preview */
  experienceHtml?: string | null;
  experienceCss?: string | null;
  experienceJs?: string | null;
  /** From latest experience version; friendlier than thread title when present */
  experienceTitle?: string | null;
  isFavourite: boolean;
};

type ThreadListResponse = {
  ok: true;
  data: {
    threads: ThreadCard[];
  };
};

type ThreadCreateResponse = {
  ok: true;
  data: {
    thread: {
      id: string;
      userId: string;
      title: string | null;
      archivedAt: string | null;
      createdAt: string;
      updatedAt: string;
    };
  };
};

type RootMode = "loading" | "marketing" | "home";

const PAGE_SIZE = 12;

export default function RootPage() {
  const router = useRouter();
  const getSupabaseClient = useSupabaseClient();
  const [mode, setMode] = useState<RootMode>("loading");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const { client: supabaseClient } = getSupabaseClient();
    if (!supabaseClient) {
      return;
    }

    void supabaseClient.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAuthError(error.message);
        setMode("marketing");
        return;
      }

      const token = data.session?.access_token ?? null;
      setAccessToken(token);
      setUserId(data.session?.user?.id ?? null);
      setMode(token ? "home" : "marketing");
    });

    const { data } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        const token = session?.access_token ?? null;
        setAccessToken(token);
        setUserId(session?.user?.id ?? null);
        setMode(token ? "home" : "marketing");
      },
    );

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const { client: supabaseClient } = getSupabaseClient();
    if (!supabaseClient) {
      return;
    }

    await supabaseClient.auth.signOut();
    setAccessToken(null);
    setUserId(null);
    setMode("marketing");
    router.replace("/");
  }

  if (mode === "home" && accessToken) {
    return (
      <HomeWorkspace
        accessToken={accessToken}
        userId={userId ?? ""}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  return <MarketingLanding authError={authError} />;
}

function HomeWorkspace(input: {
  accessToken: string;
  userId: string;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [threads, setThreads] = useState<ThreadCard[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [favouritePendingByThreadId, setFavouritePendingByThreadId] = useState<
    Record<string, boolean>
  >({});
  const [libraryFavouriteError, setLibraryFavouriteError] = useState<
    string | null
  >(null);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("auto");
  const [billingSummary, setBillingSummary] = useState<
    BillingMeResponse["data"] | null
  >(null);
  const [billingLoadState, setBillingLoadState] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const utcDayKey = new Date().toISOString().slice(0, 10);
  const exampleStarters = useMemo(
    () =>
      pickHomeExamplePrompts({
        userId: input.userId || "anonymous",
        now: new Date(`${utcDayKey}T12:00:00.000Z`),
      }),
    [input.userId, utcDayKey],
  );

  const filteredThreads = useMemo(() => {
    let list = threads;
    if (showFavouritesOnly) {
      list = list.filter((thread) => thread.isFavourite);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((thread) =>
      (thread.experienceTitle?.trim() || thread.title?.trim() || "")
        .toLowerCase()
        .includes(q),
    );
  }, [threads, searchQuery, showFavouritesOnly]);

  const pagedThreads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredThreads.slice(start, start + PAGE_SIZE);
  }, [filteredThreads, currentPage]);

  const totalPages = Math.ceil(filteredThreads.length / PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, showFavouritesOnly]);

  useEffect(() => {
    let cancelled = false;

    async function loadThreads() {
      setLoadingThreads(true);
      setThreadsError(null);

      try {
        const response = await createAuthenticatedApiClient(
          input.accessToken,
        ).getJson<ThreadListResponse>("/api/chat/threads?limit=1000");

        if (!cancelled) {
          setThreads(
            response.data.threads.map((thread) => ({
              ...thread,
              isFavourite: thread.isFavourite ?? false,
            })),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setThreadsError(toErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoadingThreads(false);
        }
      }
    }

    void loadThreads();

    return () => {
      cancelled = true;
    };
  }, [input.accessToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadBilling() {
      setBillingLoadState("loading");
      try {
        const response = await createAuthenticatedApiClient(
          input.accessToken,
        ).getJson<BillingMeResponse>("/api/billing/me");
        if (!cancelled) {
          setBillingSummary(response.data);
          setBillingLoadState("idle");
        }
      } catch {
        if (!cancelled) {
          setBillingSummary(null);
          setBillingLoadState("error");
        }
      }
    }

    void loadBilling();

    return () => {
      cancelled = true;
    };
  }, [input.accessToken]);

  async function handleThreadFavouriteToggle(thread: ThreadCard) {
    if (favouritePendingByThreadId[thread.id]) {
      return;
    }

    const next = !thread.isFavourite;
    const previous = thread.isFavourite;

    setLibraryFavouriteError(null);
    setThreads((rows) =>
      rows.map((row) =>
        row.id === thread.id ? { ...row, isFavourite: next } : row,
      ),
    );
    setFavouritePendingByThreadId((prev) => ({ ...prev, [thread.id]: true }));

    try {
      await toggleExperienceFavourite(input.accessToken, thread.id, next);
    } catch (error) {
      setThreads((rows) =>
        rows.map((row) =>
          row.id === thread.id ? { ...row, isFavourite: previous } : row,
        ),
      );
      setLibraryFavouriteError(toErrorMessage(error));
    } finally {
      setFavouritePendingByThreadId((prev) => {
        const nextMap = { ...prev };
        delete nextMap[thread.id];
        return nextMap;
      });
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (creating) {
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length === 0) {
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const response = await createAuthenticatedApiClient(
        input.accessToken,
      ).postJson<ThreadCreateResponse>("/api/chat/threads", {});

      const threadId = response.data.thread.id;
      writeHomePromptHandoff(threadId, trimmedPrompt, generationMode);
      router.push(`/chat/${threadId}`);
    } catch (error) {
      setCreateError(toErrorMessage(error));
      setCreating(false);
    }
  }

  return (
    <main className="home-shell">
      <FloatingProfileControls onSignOut={input.onSignOut} />
      <header className="home-header">
        <div>
          <h1 className="home-hero-heading">
            What will you create today?
          </h1>
        </div>
      </header>

      {billingLoadState === "error" ? (
        <p className="home-billing-muted" role="status">
          Billing summary unavailable.
        </p>
      ) : null}

      {billingSummary?.billingEnabled && billingLoadState !== "error" ? (
        <BillingStrip billingData={billingSummary} />
      ) : null}

      <form className="home-create-form" onSubmit={handleCreate}>
        <div className="home-create-row">
          <div className="home-create-input-shell">
            <input
              ref={createInputRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="A fractions challenge with playful mini rounds..."
              disabled={creating}
            />
            <div className="home-create-actions">
              <GenerationModeDropdown
                value={generationMode}
                onChange={setGenerationMode}
                disabled={creating}
              />
              <button
                type="submit"
                className={`home-create-submit ${creating ? "is-busy" : ""}`}
                disabled={creating || prompt.trim().length === 0}
                aria-label={creating ? "Starting thread" : "Create thread"}
              >
                {creating ? (
                  <LoaderCircle
                    size={18}
                    strokeWidth={2.3}
                    className="composer-spinner"
                  />
                ) : (
                  <ArrowUp size={18} strokeWidth={2.4} />
                )}
              </button>
            </div>
          </div>
        </div>

        <div
          className="home-example-prompts"
          role="group"
          aria-label="Example prompts"
        >
          {exampleStarters.map((item) => (
            <button
              key={item.prompt}
              type="button"
              className="home-example-prompt-chip"
              disabled={creating}
              title={item.prompt}
              aria-label={`Fill create field with example (${generationModeMenuLabel(item.generationMode)} mode): ${item.prompt}`}
              onClick={() => {
                setPrompt(item.prompt);
                setGenerationMode(item.generationMode);
                queueMicrotask(() => {
                  createInputRef.current?.focus();
                });
              }}
            >
              <span
                className="home-example-prompt-chip-emoji"
                aria-hidden="true"
              >
                {item.emoji}
              </span>
              <span className="home-example-prompt-chip-text-col">
                <span className="home-example-prompt-chip-label">
                  {examplePromptChipLabel(item.prompt)}
                </span>
                <span
                  className="home-example-prompt-chip-mode"
                  data-mode={item.generationMode}
                >
                  {generationModeMenuLabel(item.generationMode)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </form>

      <section className="home-creations">
        <div className="home-creations-header">
          <h2>Library</h2>
          <div className="library-toolbar">
            <button
              type="button"
              className={`library-favourites-toggle${showFavouritesOnly ? " is-active" : ""}`}
              disabled={loadingThreads || threads.length === 0}
              onClick={() => setShowFavouritesOnly((value) => !value)}
              aria-pressed={showFavouritesOnly}
              aria-label={
                showFavouritesOnly
                  ? "Show all creations"
                  : "Show favourites only"
              }
              title={showFavouritesOnly ? "Show all" : "Favourites only"}
            >
              <Star size={18} strokeWidth={2} aria-hidden />
            </button>
            <div className="library-search-shell">
              <Search
                className="library-search-icon"
                size={18}
                strokeWidth={2}
                aria-hidden
              />
              <input
                type="search"
                className="library-search-input"
                placeholder="Search your creations…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                disabled={loadingThreads || threads.length === 0}
                aria-label="Search your creations"
              />
            </div>
          </div>
        </div>

        {libraryFavouriteError ? (
          <p className="error-banner" role="status">
            {libraryFavouriteError}
          </p>
        ) : null}

        {loadingThreads ? (
          <>
            <div className="creation-skeleton" aria-hidden="true">
              <div className="skeleton-card" />
              <div className="skeleton-card" />
              <div className="skeleton-card" />
            </div>
            <p className="empty-state">Gathering your recent creations...</p>
          </>
        ) : null}

        {!loadingThreads && threadsError ? (
          <p className="error-banner">{threadsError}</p>
        ) : null}

        {!loadingThreads && !threadsError && threads.length === 0 ? (
          <p className="empty-state">
            No creations yet. Start with one idea above and Monti will draft the
            first version.
          </p>
        ) : null}

        {!loadingThreads &&
        !threadsError &&
        threads.length > 0 &&
        filteredThreads.length === 0 ? (
          <p className="empty-state">
            {showFavouritesOnly && searchQuery.trim().length === 0 ? (
              <>
                No favourited creations yet. Star an experience to save it
                here.
              </>
            ) : showFavouritesOnly && searchQuery.trim().length > 0 ? (
              <>
                No favourited creations match &quot;{searchQuery.trim()}&quot;.
              </>
            ) : (
              <>No creations match &quot;{searchQuery.trim()}&quot;.</>
            )}
          </p>
        ) : null}

        {!loadingThreads &&
        !threadsError &&
        threads.length > 0 &&
        filteredThreads.length > 0 ? (
          <>
            <div
              className="library-grid"
              role="list"
              aria-label="Your creations"
            >
              {pagedThreads.map((thread) => (
                <CreationCard
                  key={thread.id}
                  thread={thread}
                  favouritePending={Boolean(favouritePendingByThreadId[thread.id])}
                  onOpen={() => router.push(`/chat/${thread.id}`)}
                  onFavouriteToggle={() => void handleThreadFavouriteToggle(thread)}
                />
              ))}
            </div>
            {totalPages > 1 ? (
              <div className="library-pagination">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="library-pagination-label">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {createError ? <p className="error-banner">{createError}</p> : null}
    </main>
  );
}
