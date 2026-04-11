import type { User } from '@supabase/supabase-js';

/**
 * Derives display initials from a Supabase user: full_name → up to two letters;
 * otherwise first character of the email local part.
 */
export function deriveInitialsFromUser(user: User | null | undefined): string {
  if (!user) {
    return '?';
  }

  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === 'string' && fullName.trim()) {
    const words = fullName.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      const first = words[0]?.[0];
      const last = words[words.length - 1]?.[0];
      if (first && last) {
        return `${first}${last}`.toUpperCase();
      }
    }
    if (words.length === 1) {
      const w = words[0];
      if (w.length >= 2) {
        return w.slice(0, 2).toUpperCase();
      }
      if (w.length === 1) {
        return w[0].toUpperCase();
      }
    }
  }

  const email = user.email;
  if (email && email.includes('@')) {
    const local = email.split('@')[0] ?? '';
    if (local.length > 0) {
      return local[0].toUpperCase();
    }
  }

  return '?';
}
