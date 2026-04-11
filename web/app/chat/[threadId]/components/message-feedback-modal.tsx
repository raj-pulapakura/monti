'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

/** Slightly longer than dialog exit (280ms) for fallback when motion is reduced. */
const MESSAGE_MODAL_EXIT_FALLBACK_MS = 320;

export function MessageFeedbackModal(input: {
  title: string;
  detailsPlaceholder: string;
  onSubmit: (message: string | null) => void | Promise<void>;
  onDismiss: () => void;
  error: string | null;
  submitPending: boolean;
}) {
  const [exiting, setExiting] = useState(false);
  const titleId = useId();
  const detailsId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const exitDoneRef = useRef(false);

  const finishExit = useCallback(() => {
    if (exitDoneRef.current) {
      return;
    }
    exitDoneRef.current = true;
    input.onDismiss();
  }, [input.onDismiss]);

  const requestClose = useCallback(() => {
    if (input.submitPending || exiting) {
      return;
    }
    exitDoneRef.current = false;
    setExiting(true);
  }, [input.submitPending, exiting]);

  useEffect(() => {
    if (!exiting) {
      return;
    }

    const node = dialogRef.current;
    const timer = window.setTimeout(finishExit, MESSAGE_MODAL_EXIT_FALLBACK_MS);

    const onAnimEnd = (e: AnimationEvent) => {
      if (e.target !== node) {
        return;
      }
      window.clearTimeout(timer);
      finishExit();
    };

    node?.addEventListener('animationend', onAnimEnd);
    return () => {
      window.clearTimeout(timer);
      node?.removeEventListener('animationend', onAnimEnd);
    };
  }, [exiting, finishExit]);

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
    <div className={`message-feedback-modal-root${exiting ? ' is-exiting' : ''}`}>
      <button
        type="button"
        className="message-feedback-modal-backdrop"
        aria-label="Dismiss feedback dialog"
        onClick={requestClose}
        disabled={exiting}
      />
      <div
        ref={dialogRef}
        className="message-feedback-modal-dialog"
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
    </div>
  );
}
