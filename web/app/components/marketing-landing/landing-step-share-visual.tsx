'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { playDemoPublicPath, STEP_SHARE_DEMO_SLUG } from './constants';

export function LandingStepShareVisual() {
  const [origin, setOrigin] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setOrigin(typeof window !== 'undefined' ? window.location.origin : '');
  }, []);

  const shareUrl =
    origin === '' ? '' : `${origin}${playDemoPublicPath(STEP_SHARE_DEMO_SLUG)}`;

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="landing-step-visual landing-step-visual-share"
      role="group"
      aria-label="Example: copy a public play link"
    >
      <div className="landing-step-share-window">
        <div className="landing-step-share-chrome">
          <div className="landing-step-share-traffic" aria-hidden="true">
            <span className="landing-step-share-dot" />
            <span className="landing-step-share-dot" />
            <span className="landing-step-share-dot" />
          </div>
          <div className="landing-step-share-url-bar">
            <span className="landing-step-share-lock" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M3 5V3.5a3 3 0 016 0V5M2.5 5h7a1 1 0 011 1v4a1 1 0 01-1 1h-7a1 1 0 01-1-1V6a1 1 0 011-1z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="landing-step-share-url-text" title={shareUrl || undefined}>
              {shareUrl || `${playDemoPublicPath(STEP_SHARE_DEMO_SLUG)}`}
            </span>
            <button
              type="button"
              className="landing-step-share-copy"
              onClick={handleCopyLink}
              disabled={!shareUrl}
              aria-label={linkCopied ? 'Link copied' : 'Copy share link'}
            >
              {linkCopied ? (
                <>
                  <Check size={12} strokeWidth={2.5} aria-hidden className="landing-step-share-copy-icon" />
                  Copied
                </>
              ) : (
                'Copy link'
              )}
            </button>
          </div>
        </div>
        <div className="landing-step-share-stage">
          <div className="landing-step-share-stage-frame">
            <iframe
              src={`/demos/${STEP_SHARE_DEMO_SLUG}.html`}
              title="Shared experience preview"
              className="landing-step-share-iframe"
              sandbox="allow-scripts"
              loading="lazy"
              tabIndex={-1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
