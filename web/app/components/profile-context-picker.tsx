'use client';

import { useEffect, useState } from 'react';
import {
  isK12ContextSegment,
  K12_CONTEXT_SEGMENTS,
  type K12ContextSegment,
  type UserProfileContext,
} from '@/lib/user-profile-options';

const NON_K12: { value: Exclude<UserProfileContext, K12ContextSegment>; label: string }[] = [
  { value: 'higher_ed', label: 'Higher education' },
  { value: 'corporate', label: 'Corporate training' },
  { value: 'personal', label: 'Personal use' },
];

const K12_PRIMARY_LABEL = 'K-12 school';

export function ProfileContextPicker(input: {
  value: UserProfileContext | null;
  onChange: (value: UserProfileContext | null) => void;
  disabled?: boolean;
  name: string;
}) {
  const [k12Open, setK12Open] = useState(() =>
    Boolean(input.value && isK12ContextSegment(input.value)),
  );

  useEffect(() => {
    if (input.value && isK12ContextSegment(input.value)) {
      setK12Open(true);
    }
    if (input.value && !isK12ContextSegment(input.value)) {
      setK12Open(false);
    }
  }, [input.value]);

  function onK12PrimaryClick() {
    if (input.disabled) {
      return;
    }
    if (k12Open) {
      setK12Open(false);
      if (input.value !== null && isK12ContextSegment(input.value)) {
        input.onChange(null);
      }
      return;
    }
    setK12Open(true);
  }

  const k12PrimarySelected =
    (input.value !== null && isK12ContextSegment(input.value)) || k12Open;

  return (
    <div className="profile-context-picker">
      <div
        className="profile-option-grid profile-option-grid--context-list"
        role="group"
        aria-label="Your context"
      >
        <button
          type="button"
          name={input.name}
          className={`profile-option-chip${k12PrimarySelected ? ' is-selected' : ''}`}
          disabled={input.disabled}
          aria-expanded={k12Open}
          aria-pressed={k12PrimarySelected}
          onClick={onK12PrimaryClick}
        >
          {K12_PRIMARY_LABEL}
        </button>
        {k12Open
          ? K12_CONTEXT_SEGMENTS.map((option) => {
              const selected = input.value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  name={`${input.name}-k12`}
                  className={`profile-option-chip profile-option-chip--sub${
                    selected ? ' is-selected' : ''
                  }`}
                  disabled={input.disabled}
                  aria-pressed={selected}
                  onClick={() => input.onChange(option.value)}
                >
                  {option.label}
                </button>
              );
            })
          : null}
        {NON_K12.map((option) => {
          const selected = input.value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              name={input.name}
              className={`profile-option-chip${selected ? ' is-selected' : ''}`}
              disabled={input.disabled}
              aria-pressed={selected}
              onClick={() => {
                setK12Open(false);
                input.onChange(option.value);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
