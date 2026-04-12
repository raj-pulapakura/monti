'use client';

import type { ReactNode } from 'react';

/**
 * Shared modal shell used across the app (feedback, confirm, rename, etc.).
 * Use with `.app-modal-backdrop`, `.app-modal-dialog` on the panel, and
 * `useAppModalExit` for matching enter/exit motion (see globals.css).
 */
export function AppModalRoot(input: {
  children: ReactNode;
  exiting?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`app-modal-root${input.exiting ? ' is-exiting' : ''}${input.className ? ` ${input.className}` : ''}`}
    >
      {input.children}
    </div>
  );
}

export function AppModalBackdrop(input: {
  onDismiss: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      className="app-modal-backdrop"
      aria-label={input.ariaLabel ?? 'Dismiss'}
      disabled={input.disabled}
      onClick={input.onDismiss}
    />
  );
}
