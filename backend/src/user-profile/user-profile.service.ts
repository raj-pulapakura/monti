import { Injectable } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import type { UserProfileRow } from './user-profile.repository';
import { UserProfileRepository } from './user-profile.repository';
import type { ParsedPatchProfile, UserProfileContext, UserProfileRole } from './user-profile.dto';

export function buildUserProfileSystemAddendum(profile: UserProfileRow | null): string | null {
  if (!profile?.onboarding_completed_at) {
    return null;
  }

  const rolePhrase = roleToPromptPhrase(profile.role);
  const contextPhrase = contextToPromptPhrase(profile.context);
  return `User context: ${rolePhrase} Their primary setting is: ${contextPhrase}.`;
}

function roleToPromptPhrase(role: UserProfileRole): string {
  switch (role) {
    case 'educator':
      return 'The user is an educator.';
    case 'tutor':
      return 'The user is a tutor.';
    case 'student':
      return 'The user is a student.';
    case 'parent':
      return 'The user is a parent or guardian supporting a learner.';
    case 'learning_on_my_own':
      return 'The user is learning independently.';
    case 'other':
      return 'The user has a custom role (not one of the standard presets).';
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

function contextToPromptPhrase(context: UserProfileContext): string {
  switch (context) {
    case 'k12_elementary':
      return 'K-12 elementary (roughly K–5).';
    case 'k12_middle':
      return 'K-12 middle school (roughly 6–8).';
    case 'k12_high':
      return 'K-12 high school (roughly 9–12).';
    case 'k12_mixed':
      return 'K-12 across multiple grades or another K-12 setting.';
    case 'higher_ed':
      return 'Higher education.';
    case 'corporate':
      return 'Corporate training.';
    case 'personal':
      return 'Personal use.';
    default: {
      const _exhaustive: never = context;
      return _exhaustive;
    }
  }
}

@Injectable()
export class UserProfileService {
  constructor(private readonly repository: UserProfileRepository) {}

  async getByUserId(userId: string): Promise<UserProfileRow | null> {
    return this.repository.findByUserId(userId);
  }

  async patchProfile(userId: string, patch: ParsedPatchProfile): Promise<UserProfileRow> {
    const existing = await this.repository.findByUserId(userId);
    const nowIso = new Date().toISOString();

    if (!existing) {
      if (!patch.role || !patch.context) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Creating a profile requires both role and context.',
          400,
        );
      }

      return this.repository.insert({
        user_id: userId,
        role: patch.role,
        context: patch.context,
        role_other_text:
          patch.role === 'other'
            ? patch.role_other_text !== undefined
              ? patch.role_other_text
              : null
            : null,
        onboarding_completed_at: nowIso,
        updated_at: nowIso,
      });
    }

    const nextRole = patch.role ?? existing.role;
    const nextContext = patch.context ?? existing.context;
    const nextRoleOtherRaw =
      patch.role_other_text !== undefined ? patch.role_other_text : existing.role_other_text;
    const nextRoleOther = nextRole === 'other' ? nextRoleOtherRaw : null;

    const nextOnboardingAt =
      existing.onboarding_completed_at === null ? nowIso : existing.onboarding_completed_at;

    return this.repository.update(userId, {
      role: nextRole,
      context: nextContext,
      role_other_text: nextRoleOther,
      onboarding_completed_at: nextOnboardingAt,
      updated_at: nowIso,
    });
  }
}
