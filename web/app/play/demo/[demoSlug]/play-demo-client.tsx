'use client';

import type { CSSProperties } from 'react';
import { useParams } from 'next/navigation';
import { playDemoLabel } from '@/app/components/marketing-landing/constants';
import { isPublicPlayDemoSlug } from '@/lib/public-play-demos';

export function PlayDemoClient() {
  const params = useParams<{ demoSlug: string }>();
  const demoSlug = params.demoSlug ?? '';
  const allowed = isPublicPlayDemoSlug(demoSlug);
  const label = playDemoLabel(demoSlug);

  if (!allowed) {
    return (
      <div style={centeredStyle}>
        <p style={{ color: '#5b706b', fontSize: '15px' }}>This experience could not be found.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: '#f8efe3',
      }}
    >
      <iframe
        title={label}
        src={`/demos/${demoSlug}.html`}
        sandbox="allow-scripts"
        style={{
          flex: 1,
          border: 'none',
          display: 'block',
          width: '100%',
        }}
      />
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '8px 16px',
          borderTop: '1px solid #dcc8b2',
          background: '#fffaf2',
          fontSize: '12px',
          color: '#5b706b',
          flexShrink: 0,
        }}
      >
        <span>Made with</span>
        <a
          href="/"
          style={{
            color: '#bc5127',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Monti
        </a>
      </footer>
    </div>
  );
}

const centeredStyle: CSSProperties = {
  display: 'flex',
  height: '100dvh',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f8efe3',
};
