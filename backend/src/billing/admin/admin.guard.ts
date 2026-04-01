import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticationError } from '../../common/errors/app-error';
import { BillingConfigService } from '../billing-config.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: BillingConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.adminSecret;
    if (!expected) {
      throw new AuthenticationError('Admin access is not configured for this environment.');
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    const provided = extractHeaderValue(request.headers['x-admin-secret']);
    if (!provided || provided !== expected) {
      throw new AuthenticationError('Invalid admin secret.');
    }

    return true;
  }
}

function extractHeaderValue(header: unknown): string | null {
  if (typeof header === 'string') {
    const trimmed = header.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(header) && header.length > 0) {
    const first = header[0];
    return typeof first === 'string' ? first.trim() || null : null;
  }
  return null;
}
