'use client';

import type { UserProfileRole } from '@/lib/user-profile-options';
import { USER_PROFILE_ROLE_OPTIONS } from '@/lib/user-profile-options';

export function ProfileRoleGrid(input: {
  value: UserProfileRole | null;
  onChange: (value: UserProfileRole) => void;
  disabled?: boolean;
  name: string;
}) {
  return (
    <div className="profile-option-grid" role="group" aria-label="Your role">
      {USER_PROFILE_ROLE_OPTIONS.map((option) => {
        const selected = input.value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            name={input.name}
            className={`profile-option-chip${selected ? ' is-selected' : ''}`}
            disabled={input.disabled}
            aria-pressed={selected}
            onClick={() => input.onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export { ProfileContextPicker } from '@/app/components/profile-context-picker';
