/**
 * When false (`false`, `0`, or `off`, case-insensitive), blocking onboarding on `/`
 * and onboarding-pressure copy on account settings are skipped.
 * When the variable is unset or any other value, onboarding stays enabled — so production
 * builds that omit it keep blocking onboarding on. `web/.env.example` sets `false` so
 * copying it for local dev defaults to off.
 */
export function isUserOnboardingEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_USER_ONBOARDING_ENABLED?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off') {
    return false;
  }
  return true;
}
