/** Minimal shapes for Stripe webhook `data.object` payloads (avoids tight coupling to SDK types). */

export type StripeWebhookEventPayload = {
  id: string;
  type: string;
  data: { object: unknown };
};

export type CheckoutSessionLike = {
  id: string;
  mode?: string | null;
  payment_status?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string | undefined> | null;
  subscription?: string | { id: string } | null;
  customer?: string | { id: string } | null;
};

export type InvoiceLike = {
  id: string;
  subscription?: unknown;
  customer?: unknown;
  amount_paid?: number;
  period_start?: number | null;
  period_end?: number | null;
};

export type SubscriptionItemLike = {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

export type SubscriptionLike = {
  id: string;
  customer?: unknown;
  status: string;
  metadata?: Record<string, string | undefined> | null;
  /** Removed from top-level subscription in API 2026-03-25.dahlia — use items.data[0] instead. */
  current_period_start?: number | null;
  /** Removed from top-level subscription in API 2026-03-25.dahlia — use items.data[0] instead. */
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  /** Set by portal cancellation in API 2026-03-25.dahlia instead of cancel_at_period_end. */
  cancel_at?: number | null;
  items?: { data?: SubscriptionItemLike[] } | null;
};
