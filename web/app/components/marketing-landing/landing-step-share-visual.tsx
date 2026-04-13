'use client';

import { STEP_SHARE_DEMO_SLUG } from './constants';

export function LandingStepShareVisual() {
  return (
    <div className="landing-step-visual landing-step-visual-share" aria-hidden="true">
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
            <span className="landing-step-share-url-text">http://monti.app/play/projectile-motion-lab-1fd8aa</span>
            <button type="button" className="landing-step-share-copy" tabIndex={-1} disabled>
              Copy link
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
