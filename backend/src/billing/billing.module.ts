import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { BillingConfigService } from './billing-config.service';
import { BillingController } from './billing.controller';
import { BillingRepository } from './billing.repository';
import { CreditLedgerService } from './credit-ledger.service';
import { CreditReservationService } from './credit-reservation.service';
import { EntitlementService } from './entitlement.service';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [BillingController],
  providers: [
    BillingConfigService,
    BillingRepository,
    CreditLedgerService,
    CreditReservationService,
    EntitlementService,
  ],
  exports: [
    BillingConfigService,
    BillingRepository,
    CreditLedgerService,
    CreditReservationService,
    EntitlementService,
  ],
})
export class BillingModule {}
