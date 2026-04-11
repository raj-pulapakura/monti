"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthenticatedApiClient } from "@/lib/api/authenticated-api-client";
import type { BillingMeResponse } from "@/lib/api/billing-me";
import type { RedirectResponse } from "@/lib/api/types";
import { writeHomePromptHandoff } from "@/lib/chat/prompt-handoff";
import { writeThreadBootstrap } from "@/lib/chat/thread-bootstrap";
import type { GenerationMode } from "@/lib/chat/generation-mode";
import { useSupabaseClient } from "./hooks/use-supabase-client";
import { toErrorMessage } from "@/lib/errors";
import { AppTopbar } from "./components/app-topbar";
import { GenerationModeDropdown } from "./components/generation-mode-segmented-control";
import { MarketingLanding } from "./components/marketing-landing";
import { BillingGate } from "./components/billing-gate";
import { isBalanceSufficientForMode } from "@/lib/billing/is-balance-sufficient-for-mode";
import { CreationCard } from "./components/creation-card";
import {
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

const LIBRARY_BATCH_SIZE = 12;

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
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [threads, setThreads] = useState<ThreadCard[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIBRARY_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [billingLoadError, setBillingLoadError] = useState(false);
  const [billingActionPending, setBillingActionPending] = useState(false);

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

  const visibleThreads = useMemo(
    () => filteredThreads.slice(0, visibleCount),
    [filteredThreads, visibleCount],
  );
  const hasMoreVisibleThreads = visibleThreads.length < filteredThreads.length;

  useEffect(() => {
    setVisibleCount(LIBRARY_BATCH_SIZE);
    setIsLoadingMore(false);
  }, [searchQuery, showFavouritesOnly]);

  useEffect(() => {
    if (!isLoadingMore) {
      return;
    }

    setIsLoadingMore(false);
  }, [isLoadingMore, visibleThreads.length]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || loadingThreads || !hasMoreVisibleThreads) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleCount((current) => {
          if (current >= filteredThreads.length) {
            return current;
          }

          setIsLoadingMore(true);
          return Math.min(current + LIBRARY_BATCH_SIZE, filteredThreads.length);
        });
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [filteredThreads.length, hasMoreVisibleThreads, loadingThreads]);

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
      setBillingLoaded(false);
      setBillingLoadError(false);
      try {
        const response = await createAuthenticatedApiClient(
          input.accessToken,
        ).getJson<BillingMeResponse>("/api/billing/me");
        if (!cancelled) {
          setBillingSummary(response.data);
          setBillingLoadError(false);
        }
      } catch {
        if (!cancelled) {
          setBillingSummary(null);
          setBillingLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setBillingLoaded(true);
        }
      }
    }

    void loadBilling();

    return () => {
      cancelled = true;
    };
  }, [input.accessToken]);

  const balanceSufficient =
    billingSummary === null || !billingLoaded
      ? true
      : isBalanceSufficientForMode(billingSummary, generationMode);

  const softGateActive =
    billingLoaded &&
    Boolean(billingSummary?.billingEnabled) &&
    !balanceSufficient;

  async function handleBuyTopup() {
    if (billingActionPending) {
      return;
    }
    setBillingActionPending(true);
    setCreateError(null);
    try {
      const response = await createAuthenticatedApiClient(
        input.accessToken,
      ).postJson<RedirectResponse>("/api/billing/checkout/topup", {});
      const destination = response.data.checkoutUrl ?? response.data.url;
      if (!destination) {
        throw new Error("No checkout URL returned by the server.");
      }
      window.location.href = destination;
    } catch (error) {
      setBillingActionPending(false);
      setCreateError(toErrorMessage(error));
    }
  }

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
    if (creating || softGateActive) {
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
      writeThreadBootstrap(response.data.thread);
      writeHomePromptHandoff(threadId, trimmedPrompt, generationMode);
      router.push(`/chat/${threadId}`);
    } catch (error) {
      setCreateError(toErrorMessage(error));
      setCreating(false);
    }
  }

  return (
    <main className="home-shell">
      <AppTopbar onSignOut={input.onSignOut} />
      <header className="home-header">
        <div>
          <h1 className="home-hero-heading">
            Create a new learning experience
          </h1>
        </div>
      </header>

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
                creditCosts={
                  billingSummary?.billingEnabled
                    ? {
                        fast: billingSummary.costs.fastCredits,
                        quality: billingSummary.costs.qualityCredits,
                      }
                    : null
                }
              />
              <button
                type="submit"
                className={`home-create-submit ${creating ? "is-busy" : ""}`}
                disabled={
                  creating || prompt.trim().length === 0 || softGateActive
                }
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

        {softGateActive && billingSummary ? (
          <BillingGate
            plan={billingSummary.plan}
            billingActionPending={billingActionPending}
            onBuyTopup={() => void handleBuyTopup()}
          />
        ) : null}

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
              aria-label={`Use example prompt: ${item.prompt}`}
              onClick={() => {
                setPrompt(item.prompt);
                queueMicrotask(() => {
                  createInputRef.current?.focus();
                });
              }}
            >
              <span className="home-example-prompt-chip-label">
                {item.shortPrompt}
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
                placeholder="Search your experiences..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                disabled={loadingThreads || threads.length === 0}
                aria-label="Search your experiences"
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
              {visibleThreads.map((thread) => (
                <CreationCard
                  key={thread.id}
                  thread={thread}
                  favouritePending={Boolean(favouritePendingByThreadId[thread.id])}
                  onOpen={() => router.push(`/chat/${thread.id}`)}
                  onFavouriteToggle={() => void handleThreadFavouriteToggle(thread)}
                />
              ))}
            </div>
            {hasMoreVisibleThreads ? (
              <div
                ref={loadMoreRef}
                className="library-infinite-status"
                role="status"
                aria-live="polite"
              >
                {isLoadingMore
                  ? "Loading more creations..."
                  : "More creations will appear as you scroll."}
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {createError ? <p className="error-banner">{createError}</p> : null}
    </main>
  );
}
