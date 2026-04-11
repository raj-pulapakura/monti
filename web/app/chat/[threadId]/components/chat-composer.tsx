'use client';

import { FormEvent } from 'react';
import { ArrowUp, LoaderCircle } from 'lucide-react';
import { GenerationModeDropdown } from '@/app/components/generation-mode-segmented-control';
import type { GenerationMode } from '@/lib/chat/generation-mode';

export function ChatComposer(input: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  generationMode: GenerationMode;
  onGenerationModeChange: (mode: GenerationMode) => void;
  generationInFlight: boolean;
  submitPending: boolean;
  disabled: boolean;
  softGateActive: boolean;
  billingEnabled: boolean;
  creditCosts?: { fast: number | null; quality: number | null } | null;
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
          <GenerationModeDropdown
            value={input.generationMode}
            onChange={input.onGenerationModeChange}
            disabled={input.disabled}
            creditCosts={
              input.billingEnabled ? (input.creditCosts ?? null) : null
            }
          />
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
