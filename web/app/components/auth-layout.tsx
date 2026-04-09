'use client';

import type { ReactNode } from 'react';

export function AuthLayout(input: {
  title: ReactNode;
  subtitle?: string;
  children?: ReactNode;
  error?: string | null;
  success?: string | null;
  links?: ReactNode;
  shellClassName?: string;
  cardClassName?: string;
}) {
  const shellClass = ['auth-shell', input.shellClassName].filter(Boolean).join(' ');
  const cardClass = ['auth-card', input.cardClassName].filter(Boolean).join(' ');

  return (
    <main className={shellClass}>
      <section className={cardClass}>
        <h1>{input.title}</h1>
        {input.subtitle ? <p className="auth-copy">{input.subtitle}</p> : null}
        {input.children}
        {input.error ? <p className="auth-error">{input.error}</p> : null}
        {input.success ? <p className="auth-success">{input.success}</p> : null}
        {input.links ? <div className="auth-links">{input.links}</div> : null}
      </section>
    </main>
  );
}
