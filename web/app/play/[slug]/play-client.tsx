'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api/authenticated-api-client';
import { buildSrcdoc } from '@/lib/preview';

interface PublicExperience {
  title: string;
  html: string;
  css: string;
  js: string;
}

export function PlayClient() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const v = searchParams.get('v');

  const [experience, setExperience] = useState<PublicExperience | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');

  useEffect(() => {
    if (!slug) return;

    const url = v
      ? `${API_BASE_URL}/api/play/${encodeURIComponent(slug)}?v=${encodeURIComponent(v)}`
      : `${API_BASE_URL}/api/play/${encodeURIComponent(slug)}`;

    void fetch(url)
      .then(async (response) => {
        if (response.status === 404) {
          setStatus('not-found');
          return;
        }
        if (!response.ok) {
          setStatus('error');
          return;
        }
        const body = (await response.json()) as { ok: true; data: PublicExperience };
        setExperience(body.data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [slug, v]);

  if (status === 'not-found') {
    return (
      <div style={centeredStyle}>
        <p style={{ color: '#5b706b', fontSize: '15px' }}>This experience could not be found.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={centeredStyle}>
        <p style={{ color: '#9a3f32', fontSize: '15px' }}>
          Something went wrong loading this experience.
        </p>
      </div>
    );
  }

  if (status === 'loading' || !experience) {
    return (
      <div style={centeredStyle}>
        <p style={{ color: '#7b8d89', fontSize: '14px' }}>Loading experience...</p>
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
        title={experience.title}
        srcDoc={buildSrcdoc(experience.html, experience.css, experience.js)}
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

const centeredStyle: React.CSSProperties = {
  display: 'flex',
  height: '100dvh',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f8efe3',
};
