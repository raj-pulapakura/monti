import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserIdThrottlerGuard } from './user-id-throttler.guard';

describe('UserIdThrottlerGuard', () => {
  it('uses authenticated user id as the throttle tracker', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }])],
      providers: [UserIdThrottlerGuard],
    }).compile();

    const guard = moduleRef.get(UserIdThrottlerGuard);
    const tracker = await (
      guard as unknown as {
        getTracker(req: Record<string, unknown>): Promise<string>;
      }
    ).getTracker({
      authUser: { id: 'user-abc' },
      ip: '203.0.113.1',
    });

    expect(tracker).toBe('user-abc');
  });

  it('falls back to IP when auth user is missing', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }])],
      providers: [UserIdThrottlerGuard],
    }).compile();

    const guard = moduleRef.get(UserIdThrottlerGuard);
    const tracker = await (
      guard as unknown as {
        getTracker(req: Record<string, unknown>): Promise<string>;
      }
    ).getTracker({
      ip: '198.51.100.2',
    });

    expect(tracker).toBe('198.51.100.2');
  });
});
