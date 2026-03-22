'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import { writeHomePromptHandoff } from '@/lib/chat/prompt-handoff';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { FloatingProfileControls } from './components/floating-profile-controls';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type ThreadCard = {
  id: string;
  userId: string;
  title: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sandboxStatus: 'empty' | 'creating' | 'ready' | 'error' | null;
  sandboxUpdatedAt: string | null;
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

type RootMode = 'loading' | 'marketing' | 'home';

export default function RootPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [mode, setMode] = useState<RootMode>('loading');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  function getSupabaseClient() {
    if (supabaseRef.current) {
      return supabaseRef.current;
    }

    try {
      supabaseRef.current = createSupabaseBrowserClient();
      return supabaseRef.current;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      return;
    }

    void supabaseClient.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAuthError(error.message);
        setMode('marketing');
        return;
      }

      const token = data.session?.access_token ?? null;
      setAccessToken(token);
      setMode(token ? 'home' : 'marketing');
    });

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);
      setMode(token ? 'home' : 'marketing');
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      return;
    }

    await supabaseClient.auth.signOut();
    setAccessToken(null);
    setMode('marketing');
    router.replace('/');
  }

  if (mode === 'home' && accessToken) {
    return (
      <HomeWorkspace
        accessToken={accessToken}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  return <MarketingLanding authError={authError} />;
}

function HomeWorkspace(input: {
  accessToken: string;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [prompt, setPrompt] = useState('');
  const [threads, setThreads] = useState<ThreadCard[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadThreads() {
      setLoadingThreads(true);
      setThreadsError(null);

      try {
        const response = await apiClientFor(input.accessToken).getJson<ThreadListResponse>(
          '/api/chat/threads?limit=1000',
        );

        if (!cancelled) {
          setThreads(response.data.threads);
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
    if (!carouselRef.current) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }

    function updateScrollState() {
      const carousel = carouselRef.current;
      if (!carousel) {
        setCanScrollPrev(false);
        setCanScrollNext(false);
        return;
      }

      const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
      setCanScrollPrev(carousel.scrollLeft > 8);
      setCanScrollNext(carousel.scrollLeft < maxScrollLeft - 8);
    }

    updateScrollState();

    const carousel = carouselRef.current;
    if (!carousel) {
      return;
    }

    carousel.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      carousel.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [threads.length, loadingThreads, threadsError]);

  function handleCarouselStep(direction: -1 | 1) {
    const carousel = carouselRef.current;
    if (!carousel) {
      return;
    }

    const step = Math.max(240, Math.floor(carousel.clientWidth * 0.72));
    carousel.scrollBy({
      left: direction * step,
      behavior: 'smooth',
    });
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
      const response = await apiClientFor(input.accessToken).postJson<ThreadCreateResponse>(
        '/api/chat/threads',
        {},
      );

      const threadId = response.data.thread.id;
      writeHomePromptHandoff(threadId, trimmedPrompt);
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
          <h1 className="display-script home-hero-heading">What will you create today?</h1>
        </div>
      </header>

      <form className="home-create-row" onSubmit={handleCreate}>
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="A fractions challenge with playful mini rounds..."
          disabled={creating}
        />
        <button type="submit" disabled={creating || prompt.trim().length === 0}>
          {creating ? 'Starting...' : 'Create'}
        </button>
      </form>

      <section className="home-creations">
        <div className="home-creations-header">
          <h2>Recents</h2>
          <div className="carousel-nav" aria-label="Creation carousel controls">
            <button
              type="button"
              className="carousel-nav-button"
              onClick={() => handleCarouselStep(-1)}
              disabled={!canScrollPrev}
              aria-label="Scroll creations left"
            >
              <ChevronLeft size={16} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="carousel-nav-button"
              onClick={() => handleCarouselStep(1)}
              disabled={!canScrollNext}
              aria-label="Scroll creations right"
            >
              <ChevronRight size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>

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

        {!loadingThreads && threadsError ? <p className="error-banner">{threadsError}</p> : null}

        {!loadingThreads && !threadsError && threads.length === 0 ? (
          <p className="empty-state">
            No creations yet. Start with one idea above and Monti will draft the first version.
          </p>
        ) : null}

        {!loadingThreads && !threadsError && threads.length > 0 ? (
          <div
            ref={carouselRef}
            className="creations-carousel"
            role="list"
            aria-label="Recent creations"
          >
            {threads.map((thread) => (
              <button
                type="button"
                key={thread.id}
                className="creation-card"
                role="listitem"
                onClick={() => router.push(`/chat/${thread.id}`)}
              >
                <div className="creation-thumb" aria-hidden="true">
                  <span>Creation Preview</span>
                </div>
                <p className="creation-subtitle">{thread.title?.trim() || 'Untitled creation'}</p>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {createError ? <p className="error-banner">{createError}</p> : null}
    </main>
  );
}

function MarketingLanding(input: {
  authError: string | null;
}) {
  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <p className="landing-kicker">Monti Studio</p>
        <h1>
          Turn classroom ideas into <span className="display-script">wow</span> moments.
        </h1>
        <p>
          Draft, refine, and preview interactive learning experiences in one calm, bespoke creation
          space.
        </p>
        <div className="landing-actions">
          <Link href="/auth/sign-up" className="landing-primary">
            Get started
          </Link>
          <Link href="/auth/sign-in" className="landing-secondary">
            Sign in
          </Link>
        </div>
      </section>

      <section className="landing-grid">
        <article className="landing-card">
          <h2>Idea to Activity</h2>
          <p>Start with a rough prompt and shape it through guided iteration.</p>
        </article>
        <article className="landing-card">
          <h2>Conversation Studio</h2>
          <p>Keep drafting, edits, and context in one focused thread.</p>
        </article>
        <article className="landing-card">
          <h2>Live Preview Loop</h2>
          <p>See your interactive output update in a safe sandbox as you refine.</p>
        </article>
      </section>

      {input.authError ? <p className="error-banner">{input.authError}</p> : null}
    </main>
  );
}

function apiClientFor(accessToken: string) {
  return createAuthenticatedApiClient(accessToken);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'We hit a snag while updating your creation. Please try again.';
}
