import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { EntitlementService } from './entitlement.service';
import { StripeCheckoutService } from './stripe-checkout.service';

@Controller('api/billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(
    private readonly entitlements: EntitlementService,
    private readonly stripeCheckout: StripeCheckoutService,
  ) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.entitlements.getBillingMe(user.id);
    return {
      ok: true,
      data,
    };
  }

  @Post('checkout/subscription')
  async postCheckoutSubscription(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.stripeCheckout.createSubscriptionCheckoutSession(user);
    return { ok: true, data };
  }

  @Post('checkout/topup')
  async postCheckoutTopup(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.stripeCheckout.createTopupCheckoutSession(user);
    return { ok: true, data };
  }

  @Post('portal')
  async postPortal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { returnUrl?: string } = {},
  ) {
    const data = await this.stripeCheckout.createBillingPortalSession(user, body.returnUrl);
    return { ok: true, data };
  }
}
