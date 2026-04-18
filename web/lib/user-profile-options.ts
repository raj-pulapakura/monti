export type UserProfileRole =
  | 'educator'
  | 'tutor'
  | 'student'
  | 'parent'
  | 'learning_on_my_own'
  | 'other';

export type K12ContextSegment =
  | 'k12_elementary'
  | 'k12_middle'
  | 'k12_high'
  | 'k12_mixed';

export type UserProfileContext =
  | K12ContextSegment
  | 'higher_ed'
  | 'corporate'
  | 'personal';

export const K12_CONTEXT_SEGMENTS: { value: K12ContextSegment; label: string }[] = [
  { value: 'k12_elementary', label: 'Elementary (K–5)' },
  { value: 'k12_middle', label: 'Middle school (6–8)' },
  { value: 'k12_high', label: 'High school (9–12)' },
  { value: 'k12_mixed', label: 'Multiple grades / other K-12' },
];

export function isK12ContextSegment(
  value: UserProfileContext | null,
): value is K12ContextSegment {
  if (value === null) {
    return false;
  }
  return (
    value === 'k12_elementary' ||
    value === 'k12_middle' ||
    value === 'k12_high' ||
    value === 'k12_mixed'
  );
}

export const USER_PROFILE_ROLE_OPTIONS: { value: UserProfileRole; label: string }[] = [
  { value: 'educator', label: 'Educator' },
  { value: 'tutor', label: 'Tutor' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'learning_on_my_own', label: 'Learning on my own' },
  { value: 'other', label: 'Something else' },
];

const CONTEXT_LABELS: Record<UserProfileContext, string> = {
  k12_elementary: 'K-12 · Elementary (K–5)',
  k12_middle: 'K-12 · Middle school (6–8)',
  k12_high: 'K-12 · High school (9–12)',
  k12_mixed: 'K-12 · Multiple grades / other',
  higher_ed: 'Higher education',
  corporate: 'Corporate training',
  personal: 'Personal use',
};

export function labelForRole(role: UserProfileRole): string {
  return USER_PROFILE_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

export function labelForContext(context: UserProfileContext): string {
  return CONTEXT_LABELS[context] ?? context;
}
