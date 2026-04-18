'use client';

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';
import { ArrowUp, LoaderCircle } from 'lucide-react';

export function ChatComposer(input: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  generationInFlight: boolean;
  submitPending: boolean;
  disabled: boolean;
  softGateActive: boolean;
}) {
  const isBusy = input.submitPending || input.generationInFlight;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const syncComposerHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }

    const styles = window.getComputedStyle(el);
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
    const rawLine = Number.parseFloat(styles.lineHeight);
    const fontSize = Number.parseFloat(styles.fontSize) || 16;
    const lineHeight = Number.isFinite(rawLine) ? rawLine : fontSize * 1.45;

    const paddingBlock = paddingTop + paddingBottom;
    const minBlock = paddingBlock + lineHeight;
    const maxBlock = paddingBlock + lineHeight * 3;

    el.style.height = 'auto';
    const next = Math.min(Math.max(el.scrollHeight, minBlock), maxBlock);
    el.style.height = `${next}px`;
  }, []);

  useLayoutEffect(() => {
    syncComposerHeight();
  }, [input.value, input.disabled, input.generationInFlight, syncComposerHeight]);

  return (
    <form onSubmit={input.onSubmit} className="composer-row">
      <div className="composer-input-shell">
        <textarea
          ref={textareaRef}
          className="composer-prompt"
          value={input.value}
          onChange={(event) => input.onChange(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.nativeEvent.isComposing) {
              return;
            }
            if (event.key !== 'Enter' || event.shiftKey) {
              return;
            }
            event.preventDefault();
            const form = event.currentTarget.form;
            if (!form) {
              return;
            }
            form.requestSubmit();
          }}
          placeholder={
            input.generationInFlight
              ? 'Wait for the current reply to finish...'
              : 'Send a message...'
          }
          disabled={input.disabled}
          rows={1}
          spellCheck
          aria-label={input.generationInFlight ? 'Message composer, reply in progress' : 'Message composer'}
        />
        <div className="composer-actions">
          <button
            type="submit"
            className={`home-create-submit ${isBusy ? 'is-busy' : ''}`}
            disabled={
              input.disabled ||
              input.softGateActive ||
              input.value.trim().length === 0
            }
            aria-label={
              input.submitPending
                ? 'Sending prompt'
                : input.generationInFlight
                  ? 'Reply in progress'
                  : 'Send prompt'
            }
          >
            {isBusy ? (
              <LoaderCircle size={18} strokeWidth={2.3} className="composer-spinner" />
            ) : (
              <ArrowUp size={20} strokeWidth={2.4} />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
