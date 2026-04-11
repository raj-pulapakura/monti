## 1. Rate Limiting Setup

- [x] 1.1 Install `@nestjs/throttler` in the backend package
- [x] 1.2 Register `ThrottlerModule` in `AppModule` with default TTL of 60s and configurable limit via `CHAT_RATE_LIMIT_PER_MINUTE` env var (default 30)
- [x] 1.3 Create a user-ID-keyed throttler guard (extend `ThrottlerGuard`, override `getTracker` to return the authenticated user ID)
- [x] 1.4 Apply the throttler guard and `@Throttle` decorator to `POST /api/chat/threads/:threadId/messages` in `ChatRuntimeController`

## 2. Credit Pre-Check at Message Submission

- [x] 2.1 Add a `readSpendableBalance(userId: string): Promise<{ fast: number; quality: number } | null>` method to `EntitlementService` (or `BillingRepository`) that returns the user's current spendable credits per mode cost — returns `null` on fetch error (fail-open)
- [x] 2.2 Add a `checkCreditSufficiency` method (or inline logic) in `ChatRuntimeService.submitMessage` that reads the spendable balance and compares against the mode cost; skip check when `BILLING_ENABLED` or `CREDIT_ENFORCEMENT_ENABLED` is false; throw `InsufficientCreditsError` if balance is below the required cost
- [x] 2.3 Implement auto-mode downgrade: when `generationMode = auto` and quality credits are unaffordable but fast credits are available, rewrite the effective mode to `fast` before persisting the message; log a structured event for the downgrade
- [x] 2.4 Ensure `InsufficientCreditsError` from the pre-check maps to HTTP 402 in the controller/exception filter (verify existing error-mapping handles this)

## 3. Frontend — UI Soft-Gate

- [x] 3.1 Read the billing state already fetched on thread page load; derive `isBalanceSufficientForMode(billingData, selectedMode): boolean` utility
- [x] 3.2 Disable the composer submit button when billing is enabled, billing data has loaded, and `isBalanceSufficientForMode` returns false
- [x] 3.3 Render an inline warning below the composer when the submit is disabled due to insufficient credits
- [x] 3.4 Show upgrade CTA (`Upgrade` link to `/billing`) for free-plan users in the warning
- [x] 3.5 Show top-up CTA (`Buy top-up` triggering `POST /api/billing/checkout/topup`) for paid-plan users in the warning
- [x] 3.6 Ensure the warning and disabled state update reactively when the user switches generation modes
- [x] 3.7 Ensure the warning is not shown and the button is not disabled when billing data has not yet loaded

## 4. Verification

- [x] 4.1 Write unit tests for the credit pre-check logic: sufficient balance allows submission, insufficient rejects, enforcement-disabled skips the check, fetch failure fails open
- [x] 4.2 Write unit tests for auto-mode downgrade: auto + insufficient quality + sufficient fast → fast; auto + insufficient fast → INSUFFICIENT_CREDITS; auto + sufficient quality → quality
- [x] 4.3 Write unit tests for the user-ID throttler guard
- [ ] 4.4 Manually verify the UI soft-gate: disable button updates when mode is switched; correct CTA shown for free vs. paid user; warning clears when balance is sufficient
