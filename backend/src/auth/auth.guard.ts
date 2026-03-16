import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticationError } from '../common/errors/app-error';
import { AuthJwtVerifierService } from './auth-jwt-verifier.service';
import type { AuthenticatedRequest } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly verifier: AuthJwtVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new AuthenticationError('Missing bearer access token.');
    }

    request.authUser = await this.verifier.verifyAccessToken(token);
    return true;
  }
}

function extractBearerToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const [scheme, token] = value.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim().length > 0 ? token.trim() : null;
}
