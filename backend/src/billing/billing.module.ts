import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { BillingConfigService } from './billing-config.service';
import { BillingController } from './billing.controller';
import { BillingRepository } from './billing.repository';
import { CreditLedgerService } from './credit-ledger.service';
import { CreditReservationService } from './credit-reservation.service';
import { AdminController } from './admin/admin.controller';
import { AdminGuard } from './admin/admin.guard';
import { EntitlementService } from './entitlement.service';
import { StripeCheckoutService } from './stripe-checkout.service';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [BillingController, StripeWebhookController, AdminController],
  providers: [
    BillingConfigService,
    BillingRepository,
    AdminGuard,
    CreditLedgerService,
    CreditReservationService,
    EntitlementService,
    StripeService,
    StripeCheckoutService,
    StripeWebhookService,
  ],
  exports: [
    BillingConfigService,
    BillingRepository,
    CreditLedgerService,
    CreditReservationService,
    EntitlementService,
    StripeService,
    StripeCheckoutService,
    StripeWebhookService,
  ],
})
export class BillingModule {}
