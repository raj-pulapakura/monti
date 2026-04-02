## MODIFIED Requirements

### Requirement: Map Stripe subscription lifecycle into Monti entitlement state
The system MUST align Monti's paid entitlement lifecycle with verified Stripe billing events. At launch, the free plan acts as the onboarding allowance and there is no separate Stripe trial. Initial paid-cycle access and subsequent monthly paid grants MUST begin only after verified successful collection. Cancellation MUST preserve the user's paid entitlement until the Stripe paid-through period ends, after which recurring paid grants stop and top-up buckets become frozen until reactivation.

When processing `invoice.paid`, if the `billing_customers` row for the invoice's Stripe customer does not yet exist or has no `stripe_customer_id` mapping, the system MUST resolve the Monti user from the subscription's `metadata.monti_user_id` field and repair the customer mapping before completing grant creation. The system MUST NOT silently drop the event when user resolution via customer mapping fails but subscription metadata is available.

#### Scenario: Initial subscription payment activates the paid cycle
- **WHEN** Monti receives the first verified successful payment event for a new subscription
- **THEN** the user becomes paid, receives the paid recurring grant for that billing period, and becomes eligible for top-up checkout

#### Scenario: Subscription cancellation preserves access until period end
- **WHEN** a paid user cancels their subscription while the Stripe paid-through period is still in the future
- **THEN** Monti keeps the paid entitlement active until the period end and does not remove already-granted paid-cycle access immediately

#### Scenario: Paid entitlement lapses after the paid-through period
- **WHEN** the Stripe paid-through period ends without successful renewal
- **THEN** Monti ends the paid entitlement, stops recurring paid grants, and freezes any remaining top-up buckets until the user reactivates

#### Scenario: invoice.paid arrives before checkout.session.completed
- **WHEN** `invoice.paid` is delivered before `checkout.session.completed` and `billing_customers.stripe_customer_id` is not yet set
- **THEN** the system resolves the Monti user from the subscription's `metadata.monti_user_id`, repairs the customer mapping, and creates the paid recurring grant without error

#### Scenario: checkout.session.completed establishes the customer mapping
- **WHEN** a subscription-mode `checkout.session.completed` event is processed
- **THEN** the system upserts `billing_customers.stripe_customer_id` from the session's customer field so subsequent invoice events can resolve the user via the standard customer-mapping lookup

## ADDED Requirements

### Requirement: Webhook handlers MUST NOT silently drop initial paid grants when subscription metadata is available
When `invoice.paid` cannot resolve the Monti user via the `billing_customers` customer mapping, the system MUST attempt fallback resolution using `metadata.monti_user_id` on the Stripe subscription object. If fallback resolution succeeds, the system MUST repair the `billing_customers` mapping and complete paid grant creation. If both resolution paths fail, the system MUST log at warn level with sufficient context (Stripe customer ID, subscription ID) for operator investigation, then return without error so Stripe does not retry an unresolvable event.

#### Scenario: Fallback resolution succeeds and grant is created
- **WHEN** `invoice.paid` arrives, `findUserIdByStripeCustomerId` returns null, but the subscription's `metadata.monti_user_id` contains a valid Monti user ID
- **THEN** the system repairs `billing_customers.stripe_customer_id`, creates the paid recurring grant, and marks the event `processed`

#### Scenario: Both resolution paths fail
- **WHEN** `invoice.paid` arrives, `findUserIdByStripeCustomerId` returns null, and the subscription's `metadata.monti_user_id` is also absent
- **THEN** the system logs a warning with the Stripe customer ID and subscription ID and returns without creating a grant or throwing
