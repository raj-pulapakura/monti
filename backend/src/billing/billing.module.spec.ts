import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SupabaseConfigService } from '../supabase/supabase-config.service';
import { SUPABASE_ADMIN_CLIENT, SUPABASE_CLIENT } from '../supabase/supabase.constants';
import type { MontiSupabaseClient } from '../supabase/supabase.types';
import { SupabaseModule } from '../supabase/supabase.module';
import { BillingModule } from './billing.module';
import { BillingRepository } from './billing.repository';

function mockClient(): MontiSupabaseClient {
  const rowChain: Record<string, unknown> = {
    eq: () => rowChain,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
  };
  rowChain.select = () => rowChain;
  const root = {
    from: () => ({
      ...rowChain,
      insert: () => rowChain,
    }),
    rpc: async () => ({ data: '00000000-0000-0000-0000-000000000001', error: null }),
  };
  return root as unknown as MontiSupabaseClient;
}

@Module({
  providers: [
    { provide: SUPABASE_ADMIN_CLIENT, useFactory: mockClient },
    { provide: SUPABASE_CLIENT, useFactory: mockClient },
    {
      provide: SupabaseConfigService,
      useValue: {
        url: 'https://example.supabase.co',
        key: 'test-service-role',
        anonKey: 'test-anon',
      },
    },
  ],
  exports: [SUPABASE_ADMIN_CLIENT, SUPABASE_CLIENT, SupabaseConfigService],
})
class MockSupabaseModule {}

describe('BillingModule', () => {
  const prevUrl = process.env.SUPABASE_URL;

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
  });

  afterAll(() => {
    process.env.SUPABASE_URL = prevUrl;
  });

  it('compiles with mocked Supabase', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [BillingModule],
    })
      .overrideModule(SupabaseModule)
      .useModule(MockSupabaseModule)
      .compile();

    expect(moduleRef.get(BillingRepository)).toBeDefined();
  });
});
