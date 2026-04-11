'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { submitFeedback } from '@/lib/feedback/submit-feedback';
import { toErrorMessage } from '@/lib/errors';

const FLOATING_PANEL_EXIT_FALLBACK_MS = 320;

export function FloatingFeedbackButton() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const [text, setText] = useState('');
  const [submitPending, setSubmitPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expandedPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const finishCollapse = useCallback(() => {
    setOverlayOpen(false);
    setCollapsing(false);
    setText('');
    setError(null);
  }, []);

  const requestCollapse = useCallback(() => {
    if (submitPending || collapsing || !overlayOpen) {
      return;
    }
    setCollapsing(true);
  }, [submitPending, collapsing, overlayOpen]);

  useEffect(() => {
    if (!collapsing) {
      return;
    }

    const node = expandedPanelRef.current;
    const timer = window.setTimeout(finishCollapse, FLOATING_PANEL_EXIT_FALLBACK_MS);

    const onAnimEnd = (e: AnimationEvent) => {
      if (e.target !== node) {
        return;
      }
      window.clearTimeout(timer);
      finishCollapse();
    };

    node?.addEventListener('animationend', onAnimEnd);
    return () => {
      window.clearTimeout(timer);
      node?.removeEventListener('animationend', onAnimEnd);
    };
  }, [collapsing, finishCollapse]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { data, error: sessionError } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (sessionError || !token) {
      setError('Your session expired. Sign in again to send feedback.');
      return;
    }

    setSubmitPending(true);
    setError(null);
    try {
      await submitFeedback(token, { kind: 'general', message: trimmed });
      requestCollapse();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitPending(false);
    }
  }, [text, requestCollapse]);

  if (hasSession === false || hasSession === null) {
    return null;
  }

  return (
    <div className="floating-feedback-root">
      {overlayOpen ? (
        <div
          className={`floating-feedback-backdrop${collapsing ? ' is-collapsing' : ''}`}
          aria-hidden="true"
          onClick={requestCollapse}
        />
      ) : null}
      <div
        className={`floating-feedback-panel${overlayOpen ? ' is-expanded' : ''}`}
        role={overlayOpen ? 'dialog' : undefined}
        aria-modal={overlayOpen ? true : undefined}
        aria-label={overlayOpen ? 'Send feedback' : undefined}
      >
        {overlayOpen ? (
          <div
            ref={expandedPanelRef}
            className={`floating-feedback-expanded${collapsing ? ' is-collapsing' : ''}`}
          >
            <div className="floating-feedback-expanded-header">
              <span className="floating-feedback-title">Share feedback</span>
              <button
                type="button"
                className="floating-feedback-icon-dismiss"
                onClick={requestCollapse}
                disabled={collapsing}
                aria-label="Close feedback"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>
            <textarea
              className="floating-feedback-textarea"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What would make Monti better for you?"
              disabled={submitPending || collapsing}
            />
            {error ? <p className="floating-feedback-error">{error}</p> : null}
            <div className="floating-feedback-actions">
              <button
                type="button"
                className="floating-feedback-submit"
                disabled={submitPending || collapsing || text.trim().length === 0}
                onClick={() => void handleSubmit()}
              >
                {submitPending ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="floating-feedback-trigger"
            onClick={() => {
              setOverlayOpen(true);
              setCollapsing(false);
            }}
            aria-label="Open feedback"
            aria-expanded={false}
          >
            <MessageSquare size={20} strokeWidth={2.15} />
          </button>
        )}
      </div>
    </div>
  );
}
