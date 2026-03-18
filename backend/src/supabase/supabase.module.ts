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
import { AuthenticationError } from '../common/errors/app-error';

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
        const token =
          request.authUser?.token ?? extractBearerToken(request.headers.authorization);
        if (!token) {
          throw new AuthenticationError('Missing bearer access token.');
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

function extractBearerToken(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return null;
  }

  const [scheme, token] = raw.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}
