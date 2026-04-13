'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import {
  REFINE_PHASE_MS,
  STEP_REFINE_DEMO_SLUG,
  type RefineAnimPhase,
} from './constants';
import { getReducedMotionSnapshot, subscribeReducedMotion } from './reduced-motion';

export function LandingStepRefineVisual() {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  const [animPhase, setAnimPhase] = useState<RefineAnimPhase>(0);
  const phase: RefineAnimPhase = prefersReducedMotion ? 5 : animPhase;

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    async function loop() {
      while (!cancelled) {
        setAnimPhase(0);
        await wait(REFINE_PHASE_MS.empty);
        if (cancelled) return;
        setAnimPhase(1);
        await wait(REFINE_PHASE_MS.afterMsg1);
        if (cancelled) return;
        setAnimPhase(2);
        await wait(REFINE_PHASE_MS.afterMsg2);
        if (cancelled) return;
        setAnimPhase(3);
        await wait(REFINE_PHASE_MS.loadingBeforeMsg3);
        if (cancelled) return;
        setAnimPhase(4);
        await wait(REFINE_PHASE_MS.loadingWithMsg3);
        if (cancelled) return;
        setAnimPhase(5);
        await wait(REFINE_PHASE_MS.holdIframe);
        if (cancelled) return;
        await wait(REFINE_PHASE_MS.beforeRepeat);
      }
    }

    void loop();
    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
    };
  }, [prefersReducedMotion]);

  const showMsg1 = phase >= 1;
  const showMsg2 = phase >= 2;
  const showMsg3 = phase >= 4;
  const previewLoading = phase >= 3 && phase <= 4;
  const showIframe = phase >= 5;

  return (
    <div className="landing-step-visual landing-step-visual-refine" aria-hidden="true">
      <div className="landing-step-refine-inner">
        <div className="landing-step-refine-chat">
          {showMsg1 ? (
            <div className="landing-step-bubble landing-step-bubble-assistant landing-step-refine-bubble-in">
              I’ll turn that into an interactive experience. Want a quiz, explorer, or story
              mode?
            </div>
          ) : null}
          {showMsg2 ? (
            <div className="landing-step-bubble landing-step-bubble-user landing-step-refine-bubble-in">
              Explorer mode — keep vocabulary light, add orbit speeds on hover.
            </div>
          ) : null}
          {showMsg3 ? (
            <div className="landing-step-bubble landing-step-bubble-assistant landing-step-refine-bubble-in">
              Done — check the preview. Say the word if you want it calmer or more detailed.
            </div>
          ) : null}
        </div>
        <div className="landing-step-refine-preview">
          <div className="landing-step-refine-frame">
            {phase <= 2 ? <div className="landing-step-refine-canvas-empty" /> : null}
            {previewLoading ? (
              <div className="landing-step-refine-loading" key="loading">
                <Loader2
                  className="landing-step-refine-loading-icon"
                  size={26}
                  strokeWidth={2.2}
                  aria-hidden={true}
                />
                <span className="landing-step-refine-loading-label">Generating…</span>
              </div>
            ) : null}
            {showIframe ? (
              <iframe
                src={`/demos/${STEP_REFINE_DEMO_SLUG}.html`}
                title="Preview: solar system demo"
                className="landing-step-refine-iframe landing-step-refine-iframe-in"
                sandbox="allow-scripts"
                loading="lazy"
                tabIndex={-1}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
