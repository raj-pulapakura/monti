'use client';

import type { CSSProperties } from 'react';
import {
  ArrowUp,
  Coins,
  Expand,
  Link2,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import {
  type DemoSlug,
  HERO_MOCK_ASSISTANT_MESSAGE,
  HERO_MOCK_EXPERIENCE_TITLE,
  HERO_MOCK_SUGGESTION_LABELS,
  HERO_MOCK_USER_MESSAGE,
} from './constants';
import { useLandingHeroMockSequence } from './use-landing-hero-mock-sequence';

export function LandingHeroWorkspaceMock(input: {
  demoSlug: DemoSlug;
  demoLabel: string;
  onExpandDemo: () => void;
}) {
  const {
    rootRef,
    introVisible,
    reducedMotion,
    showUser,
    showThinking,
    showAssistant,
    showChips,
    previewMasked,
    isBuilding,
    pulseExpand,
  } = useLandingHeroMockSequence();

  const viewportClass = [
    'landing-hero-mock-viewport',
    introVisible ? 'is-hero-mock-intro-visible' : '',
    reducedMotion ? 'is-hero-mock-reduced' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className="landing-hero-mock"
      role="region"
      aria-label="Example Monti workspace with a live demo preview"
    >
      <div className={viewportClass}>
        <nav className="landing-hero-mock-appbar" aria-hidden="true">
          <span className="app-topbar-logo landing-hero-mock-logo-static">
            <span className="app-topbar-logo-mark" aria-hidden>
              <span className="app-topbar-logo-tile" />
              <span className="app-topbar-logo-tile app-topbar-logo-tile--tr" />
              <span className="app-topbar-logo-tile app-topbar-logo-tile--bl" />
              <span className="app-topbar-logo-tile" />
            </span>
            <span className="app-topbar-logo-text">monti</span>
          </span>
          <div className="landing-hero-mock-appbar-end">
            <span className="landing-hero-mock-credits">
              <Coins size={15} strokeWidth={2.2} aria-hidden />
              <span>12</span>
            </span>
            <span className="landing-hero-mock-avatar" aria-hidden>
              RP
            </span>
          </div>
        </nav>

        <div className="landing-hero-mock-workspace">
          <section className="chat-panel landing-hero-mock-chat" aria-hidden="true">
            <div className="chat-scroll landing-hero-mock-chat-scroll">
              <article
                className={`message-row message-user landing-hero-mock-msg landing-hero-mock-msg-user${showUser ? ' is-visible' : ''}`}
              >
                <p className="message-content">{HERO_MOCK_USER_MESSAGE}</p>
              </article>
              {showThinking ? (
                <article className="message-row message-assistant message-status landing-hero-mock-msg landing-hero-mock-msg-thinking">
                  <p className="chat-build-indicator" role="status" aria-live="polite">
                    <span className="chat-build-indicator-text">Thinking...</span>
                  </p>
                </article>
              ) : null}
              <article
                className={`message-row message-assistant landing-hero-mock-msg landing-hero-mock-msg-assistant${showAssistant ? ' is-visible' : ''}`}
              >
                <div className="message-assistant-stack">
                  <p className="message-content">{HERO_MOCK_ASSISTANT_MESSAGE}</p>
                </div>
              </article>
            </div>

            <div
              className={`prompt-pill-row landing-hero-mock-pills${showChips ? ' is-visible' : ''}`}
              aria-hidden="true"
            >
              {HERO_MOCK_SUGGESTION_LABELS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className="prompt-pill landing-hero-mock-chip"
                  disabled
                  tabIndex={-1}
                  style={{ '--i': i } as CSSProperties}
                >
                  <Plus size={12} strokeWidth={2.5} aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            <div className="composer-row landing-hero-mock-composer" aria-hidden="true">
              <div className="composer-input-shell">
                <input
                  disabled
                  readOnly
                  tabIndex={-1}
                  placeholder="Send a message..."
                />
                <div className="composer-actions">
                  <span className="landing-hero-mock-mode-pill">Auto</span>
                  <button
                    type="button"
                    className="home-create-submit"
                    disabled
                    tabIndex={-1}
                    aria-hidden
                  >
                    <ArrowUp size={20} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="sandbox-panel landing-hero-mock-sandbox">
            <div className="sandbox-header">
              <div className="sandbox-header-copy">
                <div className="sandbox-title-row">
                  <h2 className="sandbox-title-heading">{HERO_MOCK_EXPERIENCE_TITLE}</h2>
                  <button
                    type="button"
                    className="sandbox-title-icon-action"
                    disabled
                    tabIndex={-1}
                    aria-hidden
                  >
                    <Pencil size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
              <div className="sandbox-header-actions">
                <button
                  type="button"
                  className="sandbox-control-button is-favourited-star"
                  disabled
                  tabIndex={-1}
                  aria-hidden
                >
                  <Star size={17} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className="sandbox-control-button"
                  disabled
                  tabIndex={-1}
                  aria-hidden
                >
                  <Trash2 size={17} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className="sandbox-control-button"
                  disabled
                  tabIndex={-1}
                  aria-hidden
                >
                  <Link2 size={17} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className={`sandbox-control-button${pulseExpand ? ' is-hero-mock-pulse-expand' : ''}`}
                  aria-label={`Expand ${input.demoLabel} demo`}
                  title="Expand demo"
                  onClick={input.onExpandDemo}
                >
                  <Expand size={17} strokeWidth={2.2} />
                </button>
              </div>
            </div>

            <div
              className={`sandbox-stage landing-hero-mock-stage${previewMasked ? ' is-preview-masked' : ''}`}
            >
              <div className="landing-hero-mock-stage-overlay" aria-hidden="true" />
              <iframe
                src={`/demos/${input.demoSlug}.html`}
                title={`${input.demoLabel} demo preview`}
                className="sandbox-iframe"
                sandbox="allow-scripts"
                loading="eager"
              />
            </div>

            <div className="sandbox-status-bar" aria-hidden="true">
              <div className="sandbox-status-main">
                {isBuilding ? (
                  <>
                    <span className="loading-spinner" aria-hidden />
                    <span className="sandbox-status-label">Building…</span>
                  </>
                ) : (
                  <>
                    <span className="sandbox-status-ready-dot" aria-hidden />
                    <span className="sandbox-status-label">Ready</span>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
