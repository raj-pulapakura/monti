'use client';

import { AppModalBackdrop, AppModalRoot } from '@/app/components/app-modal';
import { useAppModalExit } from '@/app/hooks/use-app-modal-exit';
import type { DemoSlug } from './constants';

export function LandingDemoModal(input: {
  slug: DemoSlug;
  label: string;
  onDismiss: () => void;
}) {
  const { exiting, requestClose, dialogRef } = useAppModalExit({ onDismiss: input.onDismiss });
  return (
    <AppModalRoot exiting={exiting}>
      <AppModalBackdrop onDismiss={requestClose} />
      <div ref={dialogRef} className="app-modal-dialog landing-demo-modal">
        <div className="landing-demo-modal-header">
          <span className="landing-demo-modal-title">{input.label}</span>
          <button
            type="button"
            className="landing-demo-modal-close"
            aria-label="Close"
            onClick={requestClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <iframe
          src={`/demos/${input.slug}.html`}
          title={input.label}
          className="landing-demo-modal-iframe"
          sandbox="allow-scripts"
        />
      </div>
    </AppModalRoot>
  );
}
