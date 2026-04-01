import type { ExecutionContext } from '@nestjs/common';
import { BillingConfigService } from '../billing-config.service';
import { AdminGuard } from './admin.guard';

function contextWithSecret(secret?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: secret ? { 'x-admin-secret': secret } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  it('allows request when secret matches', () => {
    const guard = new AdminGuard({ adminSecret: 'super-secret' } as BillingConfigService);
    expect(guard.canActivate(contextWithSecret('super-secret'))).toBe(true);
  });

  it('rejects request when secret is missing', () => {
    const guard = new AdminGuard({ adminSecret: 'super-secret' } as BillingConfigService);
    expect(() => guard.canActivate(contextWithSecret())).toThrow('Invalid admin secret');
  });

  it('rejects request when secret is wrong', () => {
    const guard = new AdminGuard({ adminSecret: 'super-secret' } as BillingConfigService);
    expect(() => guard.canActivate(contextWithSecret('wrong'))).toThrow('Invalid admin secret');
  });
});
