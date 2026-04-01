/** Convert Stripe unix seconds to ISO-8601 (UTC). */
export function stripeUnixSecondsToIso(seconds: number | null | undefined): string | null {
  if (seconds == null) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}
