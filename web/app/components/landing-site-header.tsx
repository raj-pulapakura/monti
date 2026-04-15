'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MontiLogoLink } from '@/app/components/monti-logo-link';

const SCROLL_SOLID_PX = 20;

/** Sticky marketing nav: logo + Pricing / Sign in / Get started. */
export function LandingSiteHeader() {
  const [solidBar, setSolidBar] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setSolidBar(window.scrollY > SCROLL_SOLID_PX);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`landing-header${solidBar ? ' landing-header--solid' : ''}`}>
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
