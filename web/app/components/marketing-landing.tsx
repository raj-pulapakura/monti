'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LandingSiteHeader } from '@/app/components/landing-site-header';
import { AppModalBackdrop, AppModalRoot } from '@/app/components/app-modal';
import { useAppModalExit } from '@/app/hooks/use-app-modal-exit';
import { Expand } from 'lucide-react';

const DEMOS = [
  { slug: 'solar-system', label: 'Solar System' },
  { slug: 'pythagorean-theorem', label: 'Pythagorean Theorem' },
  { slug: 'animal-cell', label: 'Animal Cell' },
] as const;

type DemoSlug = (typeof DEMOS)[number]['slug'];

function DemoModal(input: { slug: DemoSlug; label: string; onDismiss: () => void }) {
  const { exiting, requestClose, dialogRef } = useAppModalExit({ onDismiss: input.onDismiss });
  return (
    <AppModalRoot exiting={exiting}>
      <AppModalBackdrop onDismiss={requestClose} />
      <div ref={dialogRef} className="app-modal-dialog landing-demo-modal">
        <div className="landing-demo-modal-header">
          <span className="landing-demo-modal-title">{input.label}</span>
          <button
            type="button"
            className="landing-demo-modal-close"
            aria-label="Close"
            onClick={requestClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <iframe
          src={`/demos/${input.slug}.html`}
          title={input.label}
          className="landing-demo-modal-iframe"
          sandbox="allow-scripts"
        />
      </div>
    </AppModalRoot>
  );
}

export function MarketingLanding(input: {
  authError: string | null;
}) {
  const shellRef = useRef<HTMLElement>(null);
  const [activeDemo, setActiveDemo] = useState<DemoSlug | null>(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Assign stagger indices so CSS transition-delay calc(var(--i) * Xms) works
    for (const group of [
      shell.querySelectorAll('.landing-showcase-card'),
      shell.querySelectorAll('.landing-final-cta-inner > *'),
    ]) {
      group.forEach((el, i) => {
        (el as HTMLElement).style.setProperty('--i', String(i));
      });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 },
    );

    // Section-level targets (showcase cards + CTA trigger off the section)
    for (const el of shell.querySelectorAll('.landing-showcase, .landing-final-cta')) {
      observer.observe(el);
    }

    // Each step observed individually — they're tall, sequential elements
    for (const step of shell.querySelectorAll('.landing-step')) {
      observer.observe(step);
    }

    return () => observer.disconnect();
  }, []);
  return (
    <main ref={shellRef} className="landing-shell">
      <LandingSiteHeader />

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1>
            Turn lessons into{' '}
            <span className="display-script">experiences.</span>
          </h1>
          {/* <p className="landing-for">For teachers, tutors &amp; parents</p> */}
          <p className="landing-subline">
            Monti turns lesson ideas into interactive experiences
            you can share with anyone.
          </p>
          <div className="landing-actions">
            <Link href="/sign-up" className="landing-primary">
              Get started free
            </Link>
            {/* <a href="#showcase" className="landing-secondary">
              See it in action
            </a> */}
          </div>
        </div>
        <div className="landing-hero-asset" aria-hidden="true">
          <div className="landing-placeholder">
            <span>Product preview</span>
          </div>
        </div>
      </section>

      {/* ── Showcase ── */}
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

      {/* ── How it works ── */}
      <section className="landing-steps">
        <div className="landing-steps-list">
          <article className="landing-step">
            <div className="landing-step-content">
              <span className="landing-step-number">1</span>
              <h3>Describe your idea</h3>
              <p>
                Start with a lesson objective. Make it a game, explainer or any format.
              </p>
            </div>
            <div className="landing-placeholder landing-placeholder-short">
              <span>Step visual</span>
            </div>
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
            <div className="landing-placeholder landing-placeholder-short">
              <span>Step visual</span>
            </div>
          </article>
          <article className="landing-step">
            <div className="landing-step-content">
              <span className="landing-step-number">3</span>
              <h3>Share with learners</h3>
              <p>
                Your experience is ready. Present with full-screen mode, or share a link via a safe, accessible URL.
              </p>
            </div>
            <div className="landing-placeholder landing-placeholder-short">
              <span>Step visual</span>
            </div>
          </article>
        </div>
      </section>

      {/* ── Final CTA ── */}
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

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Monti</span>
        <nav className="landing-footer-nav" aria-label="Footer navigation">
          <Link href="/pricing">Pricing</Link>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </footer>

      {input.authError ? <p className="error-banner">{input.authError}</p> : null}

      {activeDemo && (
        <DemoModal
          slug={activeDemo}
          label={DEMOS.find((d) => d.slug === activeDemo)!.label}
          onDismiss={() => setActiveDemo(null)}
        />
      )}
    </main>
  );
}
