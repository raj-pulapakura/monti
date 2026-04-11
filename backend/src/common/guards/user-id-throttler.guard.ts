import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../../auth/auth.types';

@Injectable()
export class UserIdThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = (req as unknown as AuthenticatedRequest).authUser;
    if (user?.id) {
      return user.id;
    }
    return String(req['ip'] ?? 'anonymous');
  }
}
