import type {
  UserProfileContext,
  UserProfileRole,
} from '@/lib/user-profile-options';

export type UserProfileResponse = {
  userId: string;
  role: UserProfileRole;
  context: UserProfileContext;
  roleOtherText: string | null;
  onboardingCompletedAt: string | null;
};

export type UserProfileGetResponse = {
  ok: true;
  data: UserProfileResponse;
};
