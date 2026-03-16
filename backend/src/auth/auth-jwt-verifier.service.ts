import { Injectable } from '@nestjs/common';
import { AuthenticationError } from '../common/errors/app-error';
import { AuthConfigService } from './auth-config.service';
import type { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthJwtVerifierService {
  private jwks: unknown | null = null;

  constructor(private readonly config: AuthConfigService) {}

  private async getJwks() {
    if (this.jwks) {
      return this.jwks;
    }

    const { createRemoteJWKSet } = await import('jose');
    this.jwks = createRemoteJWKSet(new URL(this.config.jwksUrl));
    return this.jwks;
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    try {
      const { jwtVerify } = await import('jose');
      const jwks = await this.getJwks();
      const { payload } = await jwtVerify(token, jwks as never, {
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience,
      });

      if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
        throw new AuthenticationError('Token subject claim is missing.');
      }

      return {
        id: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : null,
        token,
        claims: payload,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new AuthenticationError('Invalid or expired access token.');
    }
  }
}
