import { Module } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.constants';
import { SupabaseConfigService } from './supabase-config.service';
import type { Database } from './supabase.types';

@Module({
  providers: [
    SupabaseConfigService,
    {
      provide: SUPABASE_CLIENT,
      useFactory: (config: SupabaseConfigService) =>
        createClient<Database>(config.url, config.key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }),
      inject: [SupabaseConfigService],
    },
  ],
  exports: [SupabaseConfigService, SUPABASE_CLIENT],
})
export class SupabaseModule {}
