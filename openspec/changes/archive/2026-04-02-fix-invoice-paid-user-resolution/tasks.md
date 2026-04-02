## 1. Types

- [x] 1.1 Add `customer` field to `CheckoutSessionLike` in `stripe-webhook.types.ts`
- [x] 1.2 Add `metadata` field to `SubscriptionLike` in `stripe-webhook.types.ts` to expose `monti_user_id`

## 2. Repository

- [x] 2.1 Add `upsertBillingCustomerStripeId(userId, stripeCustomerId)` to `BillingRepository` — calls `ensureBillingCustomerRow` then `updateBillingCustomerStripeId`

## 3. Webhook Service — handleCheckoutSessionEvent

- [x] 3.1 After `syncSubscriptionMirror`, upsert `billing_customers.stripe_customer_id` from `session.customer` using the new repository method

## 4. Webhook Service — handleInvoicePaid

- [x] 4.1 Move subscription retrieval (`stripe.subscriptions.retrieve`) before the `findUserIdByStripeCustomerId` call so it's available for fallback
- [x] 4.2 When `findUserIdByStripeCustomerId` returns null, attempt fallback: read `sub.metadata?.monti_user_id`, call `upsertBillingCustomerStripeId`, assign `userId`
- [x] 4.3 When both resolution paths fail, log at warn with `customerId` and `subscriptionId` and return (do not throw)

## 5. Tests

- [x] 5.1 Add test: `invoice.paid` with no customer mapping but subscription metadata present → grant created, customer mapping upserted
- [x] 5.2 Add test: `invoice.paid` with no customer mapping and no subscription metadata → warns and returns without grant
- [x] 5.3 Add test: `checkout.session.completed` (subscription mode) → `upsertBillingCustomerStripeId` called with session's customer field

## 6. Archive

- [x] 6.1 Archive this change and update `billing-payment-lifecycle` spec
