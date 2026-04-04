'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

export function MarketingLanding(input: {
  authError: string | null;
}) {
  const shellRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );

    const sections = shell.querySelectorAll(
      '.landing-showcase, .landing-steps, .landing-personas, .landing-final-cta',
    );
    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, []);
  return (
    <main ref={shellRef} className="landing-shell">
      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <p className="landing-kicker">Monti</p>
          <h1>
            Make learning something they{' '}
            <span className="display-script">do.</span>
          </h1>
          <p className="landing-subline">
            Describe a lesson idea. Monti turns it into an interactive experience
            your learners can actually play — in minutes, no coding.
          </p>
          <div className="landing-actions">
            <Link href="/auth/sign-up" className="landing-primary">
              Get started free
            </Link>
            <a href="#showcase" className="landing-secondary">
              See it in action
            </a>
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
          <p className="landing-kicker">See what Monti creates</p>
          <h2>Interactive experiences, from a single idea.</h2>
        </div>
        <div className="landing-showcase-grid">
          <article className="landing-showcase-card">
            <div className="landing-showcase-tags">
              <span className="landing-tag">Photosynthesis</span>
              <span className="landing-tag is-muted">Middle School</span>
              <span className="landing-tag is-muted">Game</span>
            </div>
            <div className="landing-placeholder landing-placeholder-tall">
              <span>Experience preview</span>
            </div>
          </article>
          <article className="landing-showcase-card">
            <div className="landing-showcase-tags">
              <span className="landing-tag">Supply &amp; Demand</span>
              <span className="landing-tag is-muted">High School</span>
              <span className="landing-tag is-muted">Explainer</span>
            </div>
            <div className="landing-placeholder landing-placeholder-tall">
              <span>Experience preview</span>
            </div>
          </article>
          <article className="landing-showcase-card">
            <div className="landing-showcase-tags">
              <span className="landing-tag">Fractions</span>
              <span className="landing-tag is-muted">Elementary</span>
              <span className="landing-tag is-muted">Quiz</span>
            </div>
            <div className="landing-placeholder landing-placeholder-tall">
              <span>Experience preview</span>
            </div>
          </article>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="landing-steps">
        <div className="landing-section-header">
          <p className="landing-kicker">How it works</p>
          <h2>From idea to interaction in three steps.</h2>
        </div>
        <div className="landing-steps-grid">
          <article className="landing-step">
            <span className="landing-step-number">1</span>
            <h3>Describe your idea</h3>
            <p>
              Start with a rough prompt. &ldquo;Teach fractions to 4th
              graders&rdquo; is enough. Pick a format — quiz, game, or
              explainer — or let Monti choose.
            </p>
            <div className="landing-placeholder landing-placeholder-short">
              <span>Step visual</span>
            </div>
          </article>
          <div className="landing-step-connector" aria-hidden="true" />
          <article className="landing-step">
            <span className="landing-step-number">2</span>
            <h3>Refine in conversation</h3>
            <p>
              Monti generates a live preview. Chat to adjust difficulty, tone,
              or focus. See changes instantly.
            </p>
            <div className="landing-placeholder landing-placeholder-short">
              <span>Step visual</span>
            </div>
          </article>
          <div className="landing-step-connector" aria-hidden="true" />
          <article className="landing-step">
            <span className="landing-step-number">3</span>
            <h3>Share with learners</h3>
            <p>
              Your experience is ready. Send a link, embed it, or keep it in
              your library for next time.
            </p>
            <div className="landing-placeholder landing-placeholder-short">
              <span>Step visual</span>
            </div>
          </article>
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section className="landing-personas">
        <div className="landing-section-header">
          <p className="landing-kicker">Who it&rsquo;s for</p>
          <h2>Built for anyone who teaches.</h2>
        </div>
        <div className="landing-personas-grid">
          <article className="landing-persona-card">
            <h3>Teachers</h3>
            <p>
              &ldquo;I need something interactive for tomorrow&rsquo;s lesson
              on the solar system.&rdquo;
            </p>
          </article>
          <article className="landing-persona-card">
            <h3>Tutors</h3>
            <p>
              &ldquo;My student isn&rsquo;t getting quadratic equations — I
              need them to <em>see</em> it.&rdquo;
            </p>
          </article>
          <article className="landing-persona-card">
            <h3>Parents</h3>
            <p>
              &ldquo;I want to make learning fun at home without becoming a
              developer.&rdquo;
            </p>
          </article>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="landing-final-cta">
        <h2>Your next lesson is a conversation away.</h2>
        <p className="landing-final-cta-sub">Free to start. No credit card required.</p>
        <div className="landing-actions landing-actions-center">
          <Link href="/auth/sign-up" className="landing-primary">
            Get started free
          </Link>
          <Link href="/pricing" className="landing-secondary">
            See pricing
          </Link>
        </div>
      </section>

      {input.authError ? <p className="error-banner">{input.authError}</p> : null}
    </main>
  );
}
