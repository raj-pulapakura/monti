'use client';

import { ChevronDown, Gem, Sparkles, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GENERATION_MODE_OPTIONS,
  type GenerationMode,
} from '@/lib/chat/generation-mode';

const ICONS = {
  auto: Sparkles,
  fast: Zap,
  quality: Gem,
} as const;

export function GenerationModeDropdown(input: {
  value: GenerationMode;
  onChange: (value: GenerationMode) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () =>
      GENERATION_MODE_OPTIONS.find((option) => option.value === input.value) ??
      GENERATION_MODE_OPTIONS[0],
    [input.value],
  );
  const SelectedIcon = ICONS[selected.value];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="generation-mode-dropdown" ref={menuRef}>
      <button
        type="button"
        className="floating-profile-button generation-mode-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Generation mode: ${selected.label}`}
        disabled={input.disabled}
        onClick={() => setOpen((previous) => !previous)}
      >
        <SelectedIcon size={14} strokeWidth={2.1} />
        <span>{selected.label}</span>
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
                <span className="generation-mode-menu-label">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
