'use client';

import { useEffect, useState } from 'react';
import { STEP_PROMPT_EXAMPLES, STEP_PROMPT_ROTATE_MS } from './constants';

export function LandingStepPromptVisual() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % STEP_PROMPT_EXAMPLES.length);
    }, STEP_PROMPT_ROTATE_MS);

    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="landing-step-visual landing-step-visual-prompt" aria-hidden="true">
      <div className="landing-step-prompt-card">
        <div className="landing-step-prompt-field">
          <p key={index} className="landing-step-prompt-text">
            {STEP_PROMPT_EXAMPLES[index]}
          </p>
        </div>
        <div className="landing-step-prompt-actions">
          <span className="landing-step-prompt-faux-btn">Create experience</span>
        </div>
      </div>
    </div>
  );
}
