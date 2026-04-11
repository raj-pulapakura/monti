/** Requests per rolling 60s window per user (see ThrottlerModule ttl). */
export function chatRateLimitPerMinute(): number {
  const raw = process.env.CHAT_RATE_LIMIT_PER_MINUTE;
  if (raw === undefined || raw.trim() === '') {
    return 30;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}
