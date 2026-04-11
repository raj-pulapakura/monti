'use client';

import { ChevronDown, Gem, Sparkles, Zap } from 'lucide-react';
import { useMemo } from 'react';
import {
  GENERATION_MODE_OPTIONS,
  type GenerationMode,
} from '@/lib/chat/generation-mode';
import { useDropdownMenu } from '@/app/hooks/use-dropdown-menu';

const ICONS = {
  auto: Sparkles,
  fast: Zap,
  quality: Gem,
} as const;

function bracketCostForMode(
  mode: GenerationMode,
  costs: { fast: number | null; quality: number | null } | null | undefined,
): string | null {
  if (!costs) {
    return null;
  }
  if (mode === 'fast' && typeof costs.fast === 'number') {
    return `[${costs.fast} cr]`;
  }
  if (mode === 'quality' && typeof costs.quality === 'number') {
    return `[${costs.quality} cr]`;
  }
  return null;
}

export function GenerationModeDropdown(input: {
  value: GenerationMode;
  onChange: (value: GenerationMode) => void;
  disabled?: boolean;
  /** When provided with numeric fast/quality costs, show [N cr] next to Fast and Quality (menu + trigger). */
  creditCosts?: { fast: number | null; quality: number | null } | null;
}) {
  const { open, setOpen, menuRef } = useDropdownMenu();

  const selected = useMemo(
    () =>
      GENERATION_MODE_OPTIONS.find((option) => option.value === input.value) ??
      GENERATION_MODE_OPTIONS[0],
    [input.value],
  );
  const SelectedIcon = ICONS[selected.value];
  const selectedCostBracket = bracketCostForMode(selected.value, input.creditCosts ?? null);

  return (
    <div className="generation-mode-dropdown" ref={menuRef}>
      <button
        type="button"
        className="floating-profile-button generation-mode-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          selectedCostBracket
            ? `Generation mode: ${selected.label} ${selectedCostBracket}`
            : `Generation mode: ${selected.label}`
        }
        disabled={input.disabled}
        onClick={() => setOpen((previous) => !previous)}
      >
        <SelectedIcon size={14} strokeWidth={2.1} />
        <span className="generation-mode-trigger-label">{selected.label}</span>
        {selectedCostBracket ? (
          <span className="generation-mode-cost-bracket"> {selectedCostBracket}</span>
        ) : null}
        <ChevronDown
          size={14}
          strokeWidth={2.1}
          className={`profile-chevron ${open ? 'is-open' : ''}`}
        />
      </button>

      {open ? (
        <div
          className="profile-menu generation-mode-menu generation-mode-menu-up"
          role="menu"
          aria-label="Generation mode"
        >
          {GENERATION_MODE_OPTIONS.map((option) => {
            const isSelected = option.value === input.value;
            const OptionIcon = ICONS[option.value];
            const costBracket = bracketCostForMode(option.value, input.creditCosts ?? null);

            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                className={`generation-mode-menu-item ${isSelected ? 'is-selected' : ''}`}
                disabled={input.disabled}
                onClick={() => {
                  input.onChange(option.value);
                  setOpen(false);
                }}
              >
                <OptionIcon size={16} strokeWidth={2.2} />
                <span className="generation-mode-menu-text">
                  <span className="generation-mode-menu-label">{option.label}</span>
                  {costBracket ? (
                    <span className="generation-mode-cost-bracket">{costBracket}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
