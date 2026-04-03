## 1. Launch Checklist Document

- [x] 1.1 Create `docs/billing/launch-checklist.md` with a pre-flight section verifying all required env vars (`BILLING_ENABLED`, `FREE_CREDIT_GRANTS_ENABLED`, `STRIPE_WEBHOOKS_ENABLED`, `BILLING_PORTAL_ENABLED`, `TOPUPS_ENABLED`, `CREDIT_ENFORCEMENT_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PAID_MONTHLY`, `STRIPE_PRICE_ID_TOPUP_50`, `ADMIN_SECRET`, `BILLING_PUBLIC_BASE_URL`) and Stripe Dashboard config (product catalog, portal settings, webhook endpoint)
- [x] 1.2 Add staging subscription lifecycle test matrix: subscription checkout -> webhook delivery -> credit grant created -> verify `GET /api/billing/me` shows paid plan and 150 credits
- [x] 1.3 Add Stripe test-clock renewal scenario: advance clock past billing period -> verify `invoice.paid` webhook fires -> new paid-cycle grant created -> old cycle grant expired
- [x] 1.4 Add Stripe test-clock payment failure scenario: mark test card as failing -> verify `invoice.payment_failed` webhook fires -> subscription moves to past-due state -> verify enforcement blocks generation
- [x] 1.5 Add subscription cancellation scenario: cancel in portal -> verify `customer.subscription.deleted` webhook -> subscription status updated -> credits drain to zero at period end
- [x] 1.6 Add subscription reactivation scenario: reactivate after cancellation -> verify new `invoice.paid` -> new paid-cycle grant created
- [x] 1.7 Add top-up purchase scenario: purchase top-up while on paid plan -> verify `checkout.session.completed` webhook -> top-up grant created -> verify spend order (recurring before top-up)
- [x] 1.8 Add credit enforcement validation: disable all credits manually via admin reversal -> attempt generation -> verify 402 response with `INSUFFICIENT_CREDITS` error -> re-grant credits -> verify generation succeeds
- [x] 1.9 Add production flag-enable sequence with gate criteria: `BILLING_ENABLED` -> `FREE_CREDIT_GRANTS_ENABLED` -> `STRIPE_WEBHOOKS_ENABLED` -> `BILLING_PORTAL_ENABLED` -> `TOPUPS_ENABLED` -> `CREDIT_ENFORCEMENT_ENABLED`, with the verification step for each
- [x] 1.10 Add post-launch monitoring gates: verify structured log events appear (`billing.checkout_session_created`, `billing.debit_settled`, `billing.reservation_created`), reconciliation summary endpoint returns data, `billing_webhook_events` table shows no stuck `failed` rows after first real subscription

## 2. Archive

- [x] 2.1 Archive this change and mark Proposal 9 as complete in `docs/pricing/monetization-roadmap.md`

