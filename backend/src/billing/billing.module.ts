import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';
import { CreditLedgerService } from './credit-ledger.service';
import { EntitlementService } from './entitlement.service';

@Module({
  imports: [SupabaseModule],
  providers: [BillingConfigService, BillingRepository, CreditLedgerService, EntitlementService],
  exports: [BillingConfigService, BillingRepository, CreditLedgerService, EntitlementService],
})
export class BillingModule {}
