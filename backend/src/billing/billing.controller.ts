import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { EntitlementService } from './entitlement.service';

@Controller('api/billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly entitlements: EntitlementService) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.entitlements.getBillingMe(user.id);
    return {
      ok: true,
      data,
    };
  }
}
