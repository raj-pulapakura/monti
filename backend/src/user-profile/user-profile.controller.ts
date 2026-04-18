import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AppError } from '../common/errors/app-error';
import { parsePatchProfileRequest } from './user-profile.dto';
import { UserProfileService } from './user-profile.service';

@Controller('api/profile')
@UseGuards(AuthGuard)
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.userProfileService.getByUserId(user.id);
    if (!profile) {
      throw new AppError('VALIDATION_ERROR', 'Profile not found.', 404);
    }

    return {
      ok: true as const,
      data: {
        userId: profile.user_id,
        role: profile.role,
        context: profile.context,
        roleOtherText: profile.role_other_text,
        onboardingCompletedAt: profile.onboarding_completed_at,
      },
    };
  }

  @Patch()
  async patch(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = parsePatchProfileRequest(body);
    const profile = await this.userProfileService.patchProfile(user.id, parsed);

    return {
      ok: true as const,
      data: {
        userId: profile.user_id,
        role: profile.role,
        context: profile.context,
        roleOtherText: profile.role_other_text,
        onboardingCompletedAt: profile.onboarding_completed_at,
      },
    };
  }
}
