import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthConfigService {
  private readonly jwtIssuerValue: string;
  private readonly jwtAudienceValue: string;
  private readonly jwksUrlValue: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? '';
    if (supabaseUrl.length === 0) {
      throw new Error('SUPABASE_URL is required for auth configuration.');
    }

    const parsedUrl = new URL(supabaseUrl);
    const inferredIssuer = `${parsedUrl.origin}/auth/v1`;
    const jwtIssuer = process.env.SUPABASE_JWT_ISSUER?.trim() || inferredIssuer;
    const jwtAudience = process.env.SUPABASE_JWT_AUDIENCE?.trim() || 'authenticated';

    this.jwtIssuerValue = jwtIssuer;
    this.jwtAudienceValue = jwtAudience;
    this.jwksUrlValue = `${jwtIssuer.replace(/\/+$/, '')}/.well-known/jwks.json`;
  }

  get jwtIssuer(): string {
    return this.jwtIssuerValue;
  }

  get jwtAudience(): string {
    return this.jwtAudienceValue;
  }

  get jwksUrl(): string {
    return this.jwksUrlValue;
  }
}
