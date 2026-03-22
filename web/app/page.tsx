'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import { writeHomePromptHandoff } from '@/lib/chat/prompt-handoff';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

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
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Supabase authentication is not configured.',
      );
      setMode('marketing');
      return null;
    }
  }

  useEffect(() => {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      return;
    }

    void syncSession(supabaseClient);

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);
      setMode(token ? 'home' : 'marketing');
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  async function syncSession(
    supabaseClient: ReturnType<typeof createSupabaseBrowserClient>,
  ) {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      setAuthError(error.message);
      setMode('marketing');
      return;
    }

    const token = data.session?.access_token ?? null;
    setAccessToken(token);
    setMode(token ? 'home' : 'marketing');
  }

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
  const [prompt, setPrompt] = useState('');
  const [threads, setThreads] = useState<ThreadCard[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
      <header className="home-header">
        <div>
          <h1>Welcome back</h1>
          <p>What will you create today?</p>
        </div>
        <button type="button" className="signout-button" onClick={input.onSignOut}>
          Sign out
        </button>
      </header>

      <form className="home-create-row" onSubmit={handleCreate}>
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="A plane simulator..."
          disabled={creating}
        />
        <button type="submit" disabled={creating || prompt.trim().length === 0}>
          {creating ? 'Creating...' : 'Create'}
        </button>
      </form>

      <section className="home-creations">
        <h2>Past Creations</h2>

        {loadingThreads ? <p className="empty-state">Loading your creations...</p> : null}
        {!loadingThreads && threadsError ? <p className="error-banner">{threadsError}</p> : null}
        {!loadingThreads && !threadsError && threads.length === 0 ? (
          <p className="empty-state">No creations yet. Start with a prompt above.</p>
        ) : null}

        {!loadingThreads && !threadsError && threads.length > 0 ? (
          <div className="creations-carousel" role="list" aria-label="Past creations">
            {threads.map((thread) => (
              <button
                type="button"
                key={thread.id}
                className="creation-card"
                role="listitem"
                onClick={() => router.push(`/chat/${thread.id}`)}
              >
                <div className="creation-thumb" aria-hidden="true">
                  <span>Experience Preview</span>
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
        <p className="landing-kicker">Monti</p>
        <h1>Generate interactive learning experiences in minutes.</h1>
        <p>
          Prompt, iterate, and ship classroom-ready activities with safe sandbox previews and
          chat-first refinement.
        </p>
        <div className="landing-actions">
          <Link href="/auth/sign-up" className="landing-primary">
            Get Started
          </Link>
          <Link href="/auth/sign-in" className="landing-secondary">
            Sign In
          </Link>
        </div>
      </section>

      <section className="landing-grid">
        <article className="landing-card">
          <h2>Chat-First Workflow</h2>
          <p>Refine ideas conversationally and keep every iteration in one thread.</p>
        </article>
        <article className="landing-card">
          <h2>Safe Sandbox Preview</h2>
          <p>Generated HTML/CSS/JS runs in a constrained iframe for predictable behavior.</p>
        </article>
        <article className="landing-card">
          <h2>Provider-Backed Runtime</h2>
          <p>
            Route generation and conversation calls with persisted telemetry for debugging and QA.
          </p>
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

  return 'Something went wrong while processing the request.';
}
