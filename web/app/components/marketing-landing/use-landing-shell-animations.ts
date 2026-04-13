'use client';

import { useEffect, type RefObject } from 'react';

export function useLandingShellAnimations(shellRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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

    for (const el of shell.querySelectorAll(
      '.landing-showcase, .landing-steps, .landing-final-cta',
    )) {
      observer.observe(el);
    }

    for (const step of shell.querySelectorAll('.landing-step')) {
      observer.observe(step);
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shellRef stable for landing <main>
  }, []);
}
