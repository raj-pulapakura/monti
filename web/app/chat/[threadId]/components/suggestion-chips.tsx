'use client';

import { Plus } from 'lucide-react';

type RefinementSuggestion = {
  label: string;
  prompt: string;
};

export function SuggestionChips(input: {
  suggestions: RefinementSuggestion[];
  disabled: boolean;
  onSelect: (prompt: string) => void;
}) {
  if (input.suggestions.length === 0) {
    return null;
  }

  return (
    <div className="prompt-pill-row" aria-label="Suggested refinements">
      {input.suggestions.map((suggestion) => (
        <button
          key={suggestion.label}
          type="button"
          className="prompt-pill"
          disabled={input.disabled}
          onClick={() => input.onSelect(suggestion.prompt)}
        >
          <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
