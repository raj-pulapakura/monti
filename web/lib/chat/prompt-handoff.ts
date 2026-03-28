import {
  isGenerationMode,
  type GenerationMode,
} from '@/lib/chat/generation-mode';

const HOME_PROMPT_HANDOFF_PREFIX = 'monti_home_prompt_handoff_v1';

export type HomePromptHandoff = {
  prompt: string;
  generationMode: GenerationMode;
};

export function writeHomePromptHandoff(
  threadId: string,
  prompt: string,
  generationMode: GenerationMode,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedThreadId = threadId.trim();
  const normalizedPrompt = prompt.trim();
  if (normalizedThreadId.length === 0 || normalizedPrompt.length === 0) {
    return;
  }

  window.sessionStorage.setItem(
    handoffKey(normalizedThreadId),
    JSON.stringify({
      prompt: normalizedPrompt,
      generationMode,
      createdAt: new Date().toISOString(),
    }),
  );
}

export function consumeHomePromptHandoff(threadId: string): HomePromptHandoff | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const key = handoffKey(threadId);
  const raw = window.sessionStorage.getItem(key);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(key);

  try {
    const parsed = JSON.parse(raw) as {
      prompt?: unknown;
      generationMode?: unknown;
    };

    const prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '';
    if (prompt.length === 0) {
      return null;
    }

    return {
      prompt,
      generationMode: isGenerationMode(parsed.generationMode)
        ? parsed.generationMode
        : 'auto',
    };
  } catch {
    return null;
  }
}

function handoffKey(threadId: string): string {
  return `${HOME_PROMPT_HANDOFF_PREFIX}:${threadId}`;
}
