import { describe, expect, it, afterEach } from 'vitest';
import { isUserOnboardingEnabled } from './user-onboarding-flag';

describe('isUserOnboardingEnabled', () => {
  const original = process.env.NEXT_PUBLIC_USER_ONBOARDING_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_USER_ONBOARDING_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_USER_ONBOARDING_ENABLED = original;
    }
  });

  it('defaults to enabled when unset', () => {
    delete process.env.NEXT_PUBLIC_USER_ONBOARDING_ENABLED;
    expect(isUserOnboardingEnabled()).toBe(true);
  });

  it.each([
    ['false', false],
    ['FALSE', false],
    ['  false  ', false],
    ['0', false],
    ['off', false],
    ['OFF', false],
    ['true', true],
    ['1', true],
    ['yes', true],
    ['', true],
    ['maybe', true],
  ])('NEXT_PUBLIC_USER_ONBOARDING_ENABLED=%p → %p', (raw, expected) => {
    process.env.NEXT_PUBLIC_USER_ONBOARDING_ENABLED = raw;
    expect(isUserOnboardingEnabled()).toBe(expected);
  });
});
