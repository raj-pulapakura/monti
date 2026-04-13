'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { LandingSiteHeader } from '@/app/components/landing-site-header';
import { Expand } from 'lucide-react';
import { DEMOS, type DemoSlug } from './constants';
import { LandingDemoModal } from './landing-demo-modal';
import { LandingStepPromptVisual } from './landing-step-prompt-visual';
import { LandingStepRefineVisual } from './landing-step-refine-visual';
import { LandingStepShareVisual } from './landing-step-share-visual';
import { useLandingShellAnimations } from './use-landing-shell-animations';

export function MarketingLanding(input: { authError: string | null }) {
  const shellRef = useRef<HTMLElement>(null);
  const [activeDemo, setActiveDemo] = useState<DemoSlug | null>(null);

  useLandingShellAnimations(shellRef);

  return (
    <main ref={shellRef} className="landing-shell">
      <LandingSiteHeader />

      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1>
            Turn lessons into{' '}
            <span className="display-script">experiences.</span>
          </h1>
          <p className="landing-subline">
            Monti turns lesson ideas into interactive experiences
            you can share with anyone.
          </p>
          <div className="landing-actions">
            <Link href="/sign-up" className="landing-primary">
              Get started free
            </Link>
          </div>
        </div>
        <div className="landing-hero-asset" aria-hidden="true">
          <div className="landing-placeholder">
            <span>Product preview</span>
          </div>
        </div>
      </section>

      <section className="landing-showcase" id="showcase">
        <div className="landing-section-header">
          <h2>Interactive experiences, from a single idea.</h2>
          <p className="landing-section-sub">
            Teach the way <em>you</em> want to. Create quizzes, visualisers, and explainers, all in one app.
          </p>
        </div>
        <div className="landing-showcase-grid">
          {DEMOS.map(({ slug, label }) => (
            <article key={slug} className="landing-showcase-card">
              <div className="landing-showcase-card-header">
                <span className="landing-showcase-card-title">{label}</span>
                <button
                  type="button"
                  className="landing-demo-expand"
                  aria-label={`Expand ${label}`}
                  onClick={() => setActiveDemo(slug)}
                >
                  <Expand size={14} strokeWidth={2.2} />
                </button>
              </div>
              <div className="landing-demo-frame">
                <iframe
                  src={`/demos/${slug}.html`}
                  title={label}
                  className="landing-demo-iframe"
                  sandbox="allow-scripts"
                  loading="lazy"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-steps" id="how-it-works">
        <div className="landing-section-header">
          <h2>From your words to their experience.</h2>
          <p className="landing-section-sub">
            Sketch the idea, refine it in conversation, then present or share a link when it
            feels ready.
          </p>
        </div>
        <div className="landing-steps-list">
          <article className="landing-step">
            <div className="landing-step-content">
              <span className="landing-step-number">1</span>
              <h3>Describe your idea</h3>
              <p>
                Start with a lesson objective. Make it a game, explainer or any format.
              </p>
            </div>
            <LandingStepPromptVisual />
          </article>
          <article className="landing-step">
            <div className="landing-step-content">
              <span className="landing-step-number">2</span>
              <h3>Refine in conversation</h3>
              <p>
                Monti generates an interactive experience. Chat to adjust difficulty, tone,
                or focus. See changes instantly.
              </p>
            </div>
            <LandingStepRefineVisual />
          </article>
          <article className="landing-step">
            <div className="landing-step-content">
              <span className="landing-step-number">3</span>
              <h3>Share with learners</h3>
              <p>
                Your experience is ready. Present with full-screen mode, or share a link via a safe, accessible URL.
              </p>
            </div>
            <LandingStepShareVisual />
          </article>
        </div>
      </section>

      <section className="landing-final-cta">
        <div className="landing-final-cta-inner">
          <h2>Your next lesson is a conversation away.</h2>
          <p className="landing-final-cta-sub">Free to start. No credit card required.</p>
          <div className="landing-actions landing-actions-center">
            <Link href="/sign-up" className="landing-primary landing-primary-lg">
              Get started free
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Monti</span>
        <nav className="landing-footer-nav" aria-label="Footer navigation">
          <Link href="/pricing">Pricing</Link>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </footer>

      {input.authError ? <p className="error-banner">{input.authError}</p> : null}

      {activeDemo && (
        <LandingDemoModal
          slug={activeDemo}
          label={DEMOS.find((d) => d.slug === activeDemo)!.label}
          onDismiss={() => setActiveDemo(null)}
        />
      )}
    </main>
  );
}
