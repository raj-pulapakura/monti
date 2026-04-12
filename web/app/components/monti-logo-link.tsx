'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/** Start BL spin after TR kick-and-snap (~snap at 44% of --app-topbar-logo-tr-hover-duration in globals.css). */
const LOGO_BL_AFTER_TR_DELAY_MS = 220;

export type MontiLogoLinkProps = {
  href?: string;
  className?: string;
  /** @default "monti home" */
  ariaLabel?: string;
};

export function MontiLogoLink(input: MontiLogoLinkProps) {
  const { href = '/', className, ariaLabel = 'monti home' } = input;
  const [logoBlHovered, setLogoBlHovered] = useState(false);
  const [logoBlInstantReset, setLogoBlInstantReset] = useState(false);
  const logoBlHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (logoBlHoverTimerRef.current) clearTimeout(logoBlHoverTimerRef.current);
    };
  }, []);

  const linkClassName = [
    'app-topbar-logo',
    'app-topbar-logo--bl-spin',
    logoBlHovered ? 'is-bl-hovered' : '',
    logoBlInstantReset ? 'is-bl-instant' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link
      href={href}
      className={linkClassName}
      aria-label={ariaLabel}
      onMouseEnter={() => {
        setLogoBlInstantReset(false);
        if (logoBlHoverTimerRef.current) clearTimeout(logoBlHoverTimerRef.current);
        logoBlHoverTimerRef.current = setTimeout(() => {
          logoBlHoverTimerRef.current = null;
          setLogoBlHovered(true);
        }, LOGO_BL_AFTER_TR_DELAY_MS);
      }}
      onMouseLeave={() => {
        if (logoBlHoverTimerRef.current) {
          clearTimeout(logoBlHoverTimerRef.current);
          logoBlHoverTimerRef.current = null;
        }
        setLogoBlInstantReset(true);
        setLogoBlHovered(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setLogoBlInstantReset(false));
        });
      }}
    >
      <span className="app-topbar-logo-mark" aria-hidden="true">
        <span className="app-topbar-logo-tile" />
        <span className="app-topbar-logo-tile app-topbar-logo-tile--tr" />
        <span className="app-topbar-logo-tile app-topbar-logo-tile--bl" />
        <span className="app-topbar-logo-tile" />
      </span>
      <span className="app-topbar-logo-text">monti</span>
    </Link>
  );
}
