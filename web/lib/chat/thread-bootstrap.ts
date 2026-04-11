const THREAD_BOOTSTRAP_PREFIX = 'monti_chat_thread_bootstrap_v1';

/** Thread row returned by POST /api/chat/threads — used to render chat before GET hydration completes. */
export type ThreadBootstrapEnvelope = {
  id: string;
  userId: string;
  title: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function writeThreadBootstrap(thread: ThreadBootstrapEnvelope): void {
  if (typeof window === 'undefined') {
    return;
  }

  const id = thread.id.trim();
  if (id.length === 0) {
    return;
  }

  window.sessionStorage.setItem(bootstrapKey(id), JSON.stringify(thread));
}

export function consumeThreadBootstrap(threadId: string): ThreadBootstrapEnvelope | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const key = bootstrapKey(threadId.trim());
  const raw = window.sessionStorage.getItem(key);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(key);

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    const userId = typeof parsed.userId === 'string' ? parsed.userId : '';
    if (id.length === 0 || userId.length === 0) {
      return null;
    }

    return {
      id,
      userId,
      title: typeof parsed.title === 'string' || parsed.title === null ? parsed.title : null,
      archivedAt:
        typeof parsed.archivedAt === 'string' || parsed.archivedAt === null
          ? parsed.archivedAt
          : null,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function bootstrapKey(threadId: string): string {
  return `${THREAD_BOOTSTRAP_PREFIX}:${threadId}`;
}
