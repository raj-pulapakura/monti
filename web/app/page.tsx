import Link from 'next/link';

export default function LandingPage() {
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
    </main>
  );
}
