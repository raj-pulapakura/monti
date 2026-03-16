import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AuthenticationError } from '../common/errors/app-error';
import type { AuthenticatedRequest, AuthenticatedUser } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) {
      throw new AuthenticationError('Authenticated user context is missing.');
    }

    return request.authUser;
  },
);
