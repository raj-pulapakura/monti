'use client';

import Link from 'next/link';
import { MontiLogoLink } from '@/app/components/monti-logo-link';

/** Sticky marketing nav: logo + Pricing / Sign in / Get started. */
export function LandingSiteHeader() {
  return (
    <header className="landing-header">
      <MontiLogoLink className="landing-header-logo" />
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
  );
}
