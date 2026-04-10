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
      {/* ── Sticky header ── */}
      <header className="landing-header">
        <Link href="/" className="landing-header-logo">
          Monti
        </Link>
        <nav className="landing-header-nav" aria-label="Site navigation">
          <Link href="/pricing" className="landing-header-link">
            Pricing
          </Link>
          <Link href="/sign-in" className="landing-header-link">
            Sign in
          </Link>
          <Link href="/sign-up" className="landing-header-cta">
            Get started
          </Link>
        </nav>
      </header>

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
        </div>
        <div className="landing-showcase-grid">
          <article className="landing-showcase-card">
            <div className="landing-showcase-tags">
              <span className="landing-tag">Solar System</span>
              <span className="landing-tag is-muted">Middle School</span>
              <span className="landing-tag is-muted">Visualization</span>
            </div>
            <div className="landing-placeholder landing-placeholder-tall">
              <span>Experience preview</span>
            </div>
          </article>
          <article className="landing-showcase-card">
            <div className="landing-showcase-tags">
              <span className="landing-tag">Fraction Pizza</span>
              <span className="landing-tag is-muted">Elementary</span>
              <span className="landing-tag is-muted">Game</span>
            </div>
            <div className="landing-placeholder landing-placeholder-tall">
              <span>Experience preview</span>
            </div>
          </article>
          <article className="landing-showcase-card">
            <div className="landing-placeholder landing-placeholder-tall">
              <span>Coming soon</span>
            </div>
          </article>
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
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>

      {input.authError ? <p className="error-banner">{input.authError}</p> : null}
    </main>
  );
}
