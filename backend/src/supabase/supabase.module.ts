import { Module, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_ADMIN_CLIENT,
  SUPABASE_CLIENT,
} from './supabase.constants';
import { SupabaseConfigService } from './supabase-config.service';
import type { Database } from './supabase.types';
import type { AuthenticatedRequest } from '../auth/auth.types';

@Module({
  providers: [
    SupabaseConfigService,
    {
      provide: SUPABASE_ADMIN_CLIENT,
      useFactory: (config: SupabaseConfigService) =>
        createClient<Database>(config.url, config.key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }),
      inject: [SupabaseConfigService],
    },
    {
      provide: SUPABASE_CLIENT,
      scope: Scope.REQUEST,
      useFactory: (config: SupabaseConfigService, request: AuthenticatedRequest) => {
        const token = request.authUser?.token;
        if (!token) {
          throw new Error('Authenticated Supabase client requested without a bearer token.');
        }

        return createClient<Database>(config.url, config.anonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        });
      },
      inject: [SupabaseConfigService, REQUEST],
    },
  ],
  exports: [SupabaseConfigService, SUPABASE_CLIENT, SUPABASE_ADMIN_CLIENT],
})
export class SupabaseModule {}
