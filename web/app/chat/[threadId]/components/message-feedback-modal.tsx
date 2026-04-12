'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { AppModalBackdrop, AppModalRoot } from '@/app/components/app-modal';
import { useAppModalExit } from '@/app/hooks/use-app-modal-exit';

export function MessageFeedbackModal(input: {
  title: string;
  detailsPlaceholder: string;
  onSubmit: (message: string | null) => void | Promise<void>;
  onDismiss: () => void;
  error: string | null;
  submitPending: boolean;
}) {
  const titleId = useId();
  const detailsId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { exiting, requestClose, dialogRef } = useAppModalExit({
    onDismiss: input.onDismiss,
    dismissBlocked: input.submitPending,
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        requestClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  return (
    <AppModalRoot exiting={exiting}>
      <AppModalBackdrop
        ariaLabel="Dismiss feedback dialog"
        onDismiss={requestClose}
        disabled={exiting}
      />
      <div
        ref={dialogRef}
        className="app-modal-dialog message-feedback-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="message-feedback-modal-header">
          <h2 id={titleId} className="message-feedback-modal-title">
            {input.title}
          </h2>
          <button
            type="button"
            className="message-feedback-modal-dismiss"
            onClick={requestClose}
            disabled={exiting}
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>
        <label className="message-feedback-modal-label" htmlFor={detailsId}>
          Provide details (optional)
        </label>
        <textarea
          ref={textareaRef}
          id={detailsId}
          className="message-feedback-modal-textarea"
          rows={4}
          disabled={input.submitPending || exiting}
          placeholder={input.detailsPlaceholder}
          defaultValue=""
        />
        {input.error ? <p className="message-feedback-modal-error">{input.error}</p> : null}
        <div className="message-feedback-modal-actions">
          <button
            type="button"
            className="message-feedback-modal-secondary"
            onClick={requestClose}
            disabled={input.submitPending || exiting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="message-feedback-modal-primary"
            disabled={input.submitPending || exiting}
            onClick={() => {
              const el = textareaRef.current;
              const raw = el?.value ?? '';
              const trimmed = raw.trim();
              void input.onSubmit(trimmed.length === 0 ? null : trimmed);
            }}
          >
            {input.submitPending ? 'Sending…' : 'Submit'}
          </button>
        </div>
      </div>
    </AppModalRoot>
  );
}
