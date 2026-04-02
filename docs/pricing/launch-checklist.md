# Billing Launch Checklist

Use this checklist to validate monetization in staging and roll out safely in production.

## 1) Pre-Flight (Before Any Test Or Flag Change)

### Environment Variables

- `BILLING_ENABLED` is set and matches intended rollout state
- `FREE_CREDIT_GRANTS_ENABLED` is set and matches intended rollout state
- `STRIPE_WEBHOOKS_ENABLED` is set and matches intended rollout state
- `BILLING_PORTAL_ENABLED` is set and matches intended rollout state
- `TOPUPS_ENABLED` is set and matches intended rollout state
- `CREDIT_ENFORCEMENT_ENABLED` is set and matches intended rollout state
- `STRIPE_SECRET_KEY` is configured (sandbox for staging, live for production)
- `STRIPE_WEBHOOK_SECRET` matches the configured Stripe endpoint
- `STRIPE_PRICE_ID_PAID_MONTHLY` points to the correct monthly product
- `STRIPE_PRICE_ID_TOPUP_50` points to the correct top-up product
- `ADMIN_SECRET` is set for admin verification endpoints
- `BILLING_PUBLIC_BASE_URL` points to the correct web app origin

### Stripe Dashboard Configuration

- Product catalog includes active monthly subscription and top-up products
- `STRIPE_PRICE_ID_PAID_MONTHLY` exists and is active in Stripe
- `STRIPE_PRICE_ID_TOPUP_50` exists and is active in Stripe
- Customer portal is enabled with subscription cancellation + reactivation actions
- Webhook endpoint is configured to the deployed backend URL
- Webhook endpoint subscribes to required events:
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

## 2) Staging Validation Matrix

Run these in staging before production rollout. Capture evidence (request IDs, screenshots, SQL output, and API responses).

### 2.1 Subscription Checkout And Initial Entitlement

- Start subscription checkout from `/checkout/start`
- Confirm Stripe checkout completes for a staging test user
- Verify webhook delivery for checkout and first successful invoice
- Verify credit grant row exists for recurring paid-cycle grant
- Call `GET /api/billing/me` and verify:
  - plan is paid
  - available credits show `150`

### 2.2 Stripe Test-Clock Renewal Scenario

- Create/associate a Stripe test clock with the staging customer
- Advance clock beyond one billing period
- Verify `invoice.paid` webhook is received and processed
- Verify a new paid-cycle grant is created for the renewed period
- Verify old cycle grant is expired (not spendable)

### 2.3 Stripe Test-Clock Payment Failure Scenario

- Configure test payment method to fail on renewal attempt
- Advance test clock to renewal boundary
- Verify `invoice.payment_failed` webhook is received and processed
- Verify subscription transitions to `past_due` (or configured failure status)
- With `CREDIT_ENFORCEMENT_ENABLED=true`, attempt generation and verify request is blocked

### 2.4 Cancellation Scenario

- Cancel the subscription through Stripe customer portal
- Verify `customer.subscription.deleted` webhook is received and processed
- Verify local subscription status is updated accordingly
- At period end, verify recurring paid credits drain to zero/expired

### 2.5 Reactivation Scenario

- Reactivate the subscription through Stripe customer portal
- Verify next successful billing emits `invoice.paid`
- Verify a new paid-cycle grant is created for the reactivated cycle

### 2.6 Top-Up Purchase Scenario

- While on paid plan, purchase top-up package
- Verify `checkout.session.completed` webhook is received and processed
- Verify top-up grant row is created with expected credits
- Verify spend order: recurring cycle credits are consumed before top-up credits

### 2.7 Credit Enforcement Validation

- Use admin reversal flow to reduce/disable all available credits
- Attempt generation and verify `402` response with `INSUFFICIENT_CREDITS`
- Re-grant credits via admin grant flow
- Attempt generation again and verify success

## 3) Production Flag-Enable Sequence (With Gates)

Enable one flag at a time in this exact order. Do not proceed until gate criteria pass.

### Step 1: `BILLING_ENABLED`

- Enable and deploy
- Verify billing endpoints respond successfully (`/api/billing/me`, checkout bootstrap paths)
- Verify no spike in billing API errors in logs

### Step 2: `FREE_CREDIT_GRANTS_ENABLED`

- Enable and deploy
- Verify new signups/users receive expected free credit grants
- Verify no duplicate or malformed free grants in ledger

### Step 3: `STRIPE_WEBHOOKS_ENABLED`

- Enable and deploy
- Trigger a sandbox event and verify webhook receives + processes successfully
- Verify `billing_webhook_events` has no new stuck `failed` rows

### Step 4: `BILLING_PORTAL_ENABLED`

- Enable and deploy
- Verify portal session creation path succeeds
- Verify portal launch works for a paid test account

### Step 5: `TOPUPS_ENABLED`

- Enable and deploy
- Verify top-up checkout can be started and completed
- Verify top-up grant appears and is spendable after recurring balance depletion

### Step 6: `CREDIT_ENFORCEMENT_ENABLED`

- Enable and deploy
- Verify zero-credit account receives `402 INSUFFICIENT_CREDITS`
- Verify credited account can still generate successfully
- Confirm rollback plan is ready (toggle this flag off first if user-impacting issue appears)

## 4) Post-Launch Monitoring Gates

Complete these checks after first real subscription(s) in production.

- Verify structured log events are present:
  - `billing.checkout_session_created`
  - `billing.debit_settled`
  - `billing.reservation_created`
- Verify reconciliation summary endpoint returns data:
  - `GET /api/admin/reconciliation/summary` with `X-Admin-Secret`
- Verify `billing_webhook_events` table has no stuck `failed` rows after first real subscription
- Verify no unexpected rise in 402/5xx billing-related responses
- Record launch checkpoint timestamp and operator sign-off

