'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';
import type { GenerationMode } from '@/lib/chat/generation-mode';
import { GENERATION_MODE_OPTIONS } from '@/lib/chat/generation-mode';

export function ConfirmationGate(input: {
  operation: string;
  estimatedCredits: { fast: number; quality: number };
  confirmPending: boolean;
  cancelPending: boolean;
  onConfirm: (mode: GenerationMode) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<GenerationMode>('fast');

  return (
    <div className="confirmation-gate" role="dialog" aria-labelledby="confirmation-gate-title">
      <h3 id="confirmation-gate-title" className="confirmation-gate-title">
        {input.operation}
      </h3>
      <p className="confirmation-gate-subtitle">
        Choose the mode you want to use to generate the experience.
      </p>
      <div className="confirmation-gate-modes" role="radiogroup" aria-label="Generation quality">
        {GENERATION_MODE_OPTIONS.map((opt) => (
          <label key={opt.value} className="confirmation-gate-mode">
            <input
              type="radio"
              name="confirmation-quality"
              value={opt.value}
              checked={mode === opt.value}
              disabled={input.confirmPending || input.cancelPending}
              onChange={() => setMode(opt.value)}
            />
            <span className="confirmation-gate-mode-label-row">
              <span className="confirmation-gate-mode-label">{opt.label}</span>
              <button
                type="button"
                className="confirmation-gate-mode-info"
                data-tooltip={opt.tooltip}
                title={opt.tooltip}
                aria-label={`${opt.label}. ${opt.tooltip}`}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Info size={14} strokeWidth={2.25} aria-hidden />
              </button>
            </span>
            <span className="confirmation-gate-mode-credits">
              {opt.value === 'fast'
                ? `${input.estimatedCredits.fast} credits`
                : `${input.estimatedCredits.quality} credits`}
            </span>
          </label>
        ))}
      </div>
      <div className="confirmation-gate-actions">
        <button
          type="button"
          className="confirmation-gate-cancel"
          disabled={input.confirmPending || input.cancelPending}
          onClick={() => input.onCancel()}
        >
          {input.cancelPending ? 'Cancelling…' : 'Cancel'}
        </button>
        <button
          type="button"
          className="confirmation-gate-confirm"
          disabled={input.confirmPending || input.cancelPending}
          onClick={() => input.onConfirm(mode)}
        >
          {input.confirmPending ? 'Starting…' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}
