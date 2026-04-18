'use client';

import { FormEvent } from 'react';
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

  return (
    <form onSubmit={input.onSubmit} className="composer-row">
      <div className="composer-input-shell">
        <input
          value={input.value}
          onChange={(event) => input.onChange(event.target.value)}
          placeholder={
            input.generationInFlight
              ? 'Wait for the current reply to finish...'
              : 'Send a message...'
          }
          disabled={input.disabled}
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
