'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getOrCreateClientId } from '@/lib/client-id.js';
import {
  findRecentExperienceById,
  loadRecentExperiences,
  saveRecentExperience,
} from '@/lib/recent-experiences.js';

type ExperienceFormat = 'quiz' | 'game' | 'explainer';
type AudienceLevel = 'young-kids' | 'elementary' | 'middle-school';
type QualityMode = 'fast' | 'quality';

type ExperiencePayload = {
  title: string;
  description: string;
  html: string;
  css: string;
  js: string;
};

type RecentExperience = {
  id: string;
  title: string;
  prompt: string;
  createdAt: string;
  experience: ExperiencePayload;
};

type GenerationResponse = {
  ok: true;
  data: {
    experience: ExperiencePayload;
    metadata: {
      generationId: string;
      provider: 'openai' | 'anthropic' | 'gemini';
      model: string;
      qualityMode: QualityMode;
      maxTokens: number;
      renderingContract: {
        iframeOnly: true;
        sandbox: 'allow-scripts';
        networkAccess: 'disallowed';
        externalLibraries: 'disallowed';
      };
    };
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

export default function Home() {
  const [prompt, setPrompt] = useState('Teach my child about the solar system with a fun game.');
  const [format, setFormat] = useState<ExperienceFormat>('quiz');
  const [audience, setAudience] = useState<AudienceLevel>('elementary');
  const [qualityMode, setQualityMode] = useState<QualityMode>('fast');
  const [refinementInstruction, setRefinementInstruction] = useState('Make the language simpler.');
  const [activeExperience, setActiveExperience] = useState<ExperiencePayload | null>(null);
  const [activeGenerationId, setActiveGenerationId] = useState<string | null>(null);
  const [activeProviderLabel, setActiveProviderLabel] = useState<string>('');
  const [recentExperiences, setRecentExperiences] = useState<RecentExperience[]>([]);
  const [loadingMode, setLoadingMode] = useState<'generate' | 'refine' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadRecentExperiences() as RecentExperience[];
    setRecentExperiences(loaded);
  }, []);

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

  const isGenerating = loadingMode === 'generate';
  const isRefining = loadingMode === 'refine';

  async function handleGenerate(event?: FormEvent) {
    event?.preventDefault();
    if (isGenerating || isRefining) {
      return;
    }

    setErrorMessage(null);
    setLoadingMode('generate');

    try {
      const response = await postJson<GenerationResponse>('/api/experiences/generate', {
        clientId: getOrCreateClientId(),
        prompt,
        format,
        audience,
        qualityMode,
      });

      const generation = response.data;
      const entry: RecentExperience = {
        id: generation.metadata.generationId,
        title: generation.experience.title,
        prompt,
        createdAt: new Date().toISOString(),
        experience: generation.experience,
      };

      setActiveExperience(generation.experience);
      setActiveGenerationId(generation.metadata.generationId);
      setActiveProviderLabel(`${generation.metadata.provider} · ${generation.metadata.model}`);
      setRecentExperiences(saveRecentExperience(entry) as RecentExperience[]);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoadingMode(null);
    }
  }

  async function handleRefine(event: FormEvent) {
    event.preventDefault();
    if (!activeExperience || isGenerating || isRefining) {
      return;
    }

    setErrorMessage(null);
    setLoadingMode('refine');

    try {
      const response = await postJson<GenerationResponse>('/api/experiences/refine', {
        clientId: getOrCreateClientId(),
        originalPrompt: prompt,
        priorGenerationId: activeGenerationId,
        refinementInstruction,
        priorExperience: activeExperience,
        qualityMode,
      });

      const generation = response.data;
      const entry: RecentExperience = {
        id: generation.metadata.generationId,
        title: generation.experience.title,
        prompt,
        createdAt: new Date().toISOString(),
        experience: generation.experience,
      };

      setActiveExperience(generation.experience);
      setActiveGenerationId(generation.metadata.generationId);
      setActiveProviderLabel(`${generation.metadata.provider} · ${generation.metadata.model}`);
      setRecentExperiences(saveRecentExperience(entry) as RecentExperience[]);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoadingMode(null);
    }
  }

  function handleReopen(experienceId: string) {
    const reopened = findRecentExperienceById(experienceId) as RecentExperience | null;
    if (!reopened) {
      return;
    }

    setPrompt(reopened.prompt);
    setActiveExperience(reopened.experience);
    setActiveGenerationId(reopened.id);
    setActiveProviderLabel('reopened from local history');
    setErrorMessage(null);
  }

  return (
    <div className="page-shell">
      <header className="panel hero-panel">
        <p className="kicker">Monti MVP</p>
        <h1>Build interactive learning experiences from a prompt</h1>
        <p className="hero-copy">
          Prompt to generate to play to refine, with safe iframe rendering and local history.
        </p>
      </header>

      <main className="layout-grid">
        <section className="panel control-panel">
          <form onSubmit={handleGenerate} className="stack">
            <label htmlFor="prompt">Prompt</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              placeholder="Teach a 5-year-old about volcanoes with a game."
            />

            <div className="control-row">
              <div>
                <label htmlFor="format">Format</label>
                <select
                  id="format"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as ExperienceFormat)}
                >
                  <option value="quiz">Quiz</option>
                  <option value="game">Game</option>
                  <option value="explainer">Explainer</option>
                </select>
              </div>

              <div>
                <label htmlFor="audience">Audience</label>
                <select
                  id="audience"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value as AudienceLevel)}
                >
                  <option value="young-kids">Young kids</option>
                  <option value="elementary">Elementary</option>
                  <option value="middle-school">Middle school</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="quality">Speed vs quality</label>
              <select
                id="quality"
                value={qualityMode}
                onChange={(event) => setQualityMode(event.target.value as QualityMode)}
              >
                <option value="fast">Fast draft</option>
                <option value="quality">Higher quality</option>
              </select>
            </div>

            <div className="button-row">
              <button type="submit" disabled={isGenerating || isRefining || prompt.trim().length === 0}>
                {isGenerating ? 'Generating…' : 'Generate'}
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={isGenerating || isRefining || prompt.trim().length === 0}
                onClick={() => {
                  void handleGenerate();
                }}
              >
                Regenerate
              </button>
            </div>
          </form>

          <form onSubmit={handleRefine} className="stack refine-form">
            <label htmlFor="refine">Refine</label>
            <input
              id="refine"
              value={refinementInstruction}
              onChange={(event) => setRefinementInstruction(event.target.value)}
              placeholder="Make this more game-like."
            />
            <button
              type="submit"
              disabled={
                isGenerating ||
                isRefining ||
                !activeExperience ||
                !activeGenerationId ||
                refinementInstruction.trim().length === 0
              }
            >
              {isRefining ? 'Refining…' : 'Apply refinement'}
            </button>
          </form>

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

          <section className="recent-list">
            <h2>Recent creations</h2>
            {recentExperiences.length === 0 ? (
              <p className="muted">No saved creations yet.</p>
            ) : (
              <ul>
                {recentExperiences.map((item) => (
                  <li key={item.id}>
                    <div>
                      <p className="recent-title">{item.title}</p>
                      <p className="recent-meta">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    <button type="button" className="ghost-button" onClick={() => handleReopen(item.id)}>
                      Reopen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>

        <section className="panel preview-panel">
          <div className="preview-header">
            <h2>{activeExperience ? activeExperience.title : 'Preview will appear here'}</h2>
            <p>
              {activeGenerationId
                ? `ID: ${activeGenerationId}`
                : 'Rendering contract: iframe-only sandbox="allow-scripts"'}
            </p>
            {activeProviderLabel ? <p className="muted">{activeProviderLabel}</p> : null}
          </div>

          {activeExperience ? (
            <iframe
              title="Generated learning experience"
              className="preview-iframe"
              sandbox="allow-scripts"
              srcDoc={previewDocument}
            />
          ) : (
            <div className="preview-empty">
              <p>Generate an experience to start playing.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
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

  return 'Something went wrong while generating the experience.';
}
