import type { ExecutionContext } from '@nestjs/common';
import { AuthenticationError } from '../common/errors/app-error';
import type { AuthenticatedRequest, AuthenticatedUser } from './auth.types';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  function createContext(request: AuthenticatedRequest): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('rejects requests without a bearer token', async () => {
    const verifier = {
      verifyAccessToken: jest.fn(),
    };
    const guard = new AuthGuard(verifier as never);
    const request = { headers: {} } as AuthenticatedRequest;

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    expect(verifier.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects malformed authorization headers', async () => {
    const verifier = {
      verifyAccessToken: jest.fn(),
    };
    const guard = new AuthGuard(verifier as never);
    const request = {
      headers: {
        authorization: 'Basic abc123',
      },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    expect(verifier.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects invalid tokens', async () => {
    const verifier = {
      verifyAccessToken: jest.fn(async () => {
        throw new AuthenticationError('Invalid or expired access token.');
      }),
    };
    const guard = new AuthGuard(verifier as never);
    const request = {
      headers: {
        authorization: 'Bearer bad-token',
      },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    expect(verifier.verifyAccessToken).toHaveBeenCalledWith('bad-token');
  });

  it('rejects expired tokens', async () => {
    const verifier = {
      verifyAccessToken: jest.fn(async () => {
        throw new AuthenticationError('Access token expired.');
      }),
    };
    const guard = new AuthGuard(verifier as never);
    const request = {
      headers: {
        authorization: 'Bearer expired-token',
      },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    expect(verifier.verifyAccessToken).toHaveBeenCalledWith('expired-token');
  });

  it('accepts valid tokens and attaches auth user to request context', async () => {
    const authUser: AuthenticatedUser = {
      id: '9f267f98-8f91-46ac-b0a7-0591350d3f5f',
      email: 'test@example.com',
      token: 'good-token',
      claims: {
        sub: '9f267f98-8f91-46ac-b0a7-0591350d3f5f',
      },
    };
    const verifier = {
      verifyAccessToken: jest.fn(async () => authUser),
    };
    const guard = new AuthGuard(verifier as never);
    const request = {
      headers: {
        authorization: 'Bearer good-token',
      },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.authUser).toEqual(authUser);
  });
});
