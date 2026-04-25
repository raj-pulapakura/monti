# Stripe Dashboard checklist — live mode (production)

Use this checklist when Monti is ready to accept **real** payments. All steps assume Stripe **live mode** (test data **off**). Live objects, keys, and webhook secrets are **different** from sandbox—never reuse test `price_` IDs or `whsec_` values in production.

Official references:

- [API keys — Switch to live mode](https://docs.stripe.com/keys#switch-to-live-mode)
- [Go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)
- [Webhooks](https://docs.stripe.com/webhooks)
- [Customer portal — Go live](https://docs.stripe.com/customer-management/integrate-customer-portal#go-live)
- [Products and prices](https://docs.stripe.com/products-prices/manage-prices)

---

## 0. Preconditions

1. Sandbox integration is **verified** (Checkout, webhooks, portal, grants) using **test** keys.
2. You have **completed Stripe account activation** for live charges: business details, bank account for payouts, identity/verification as requested by Stripe (varies by country).
3. You know your **production** backend HTTPS base URL, e.g. `https://api.yourdomain.com`.
4. Webhook URL (once implemented):

   ```text
   https://YOUR-PRODUCTION-API-HOST/api/billing/webhooks/stripe
   ```

---

## 1. Confirm you are in live mode

1. Open [https://dashboard.stripe.com/](https://dashboard.stripe.com/).
2. **Turn OFF** “View test data” / switch to **Live mode** (exact control location follows current Dashboard UI).
3. Re-check: no “test” or “sandbox” banner should indicate you are still in test mode.

If you create prices or webhooks while still in test mode, production will not see them.

---

## 2. Reveal and store live secret key (one-time view)

Stripe **live** secret keys can only be **fully revealed once** when first created or rolled—if lost, you must rotate ([API keys](https://docs.stripe.com/keys)).

1. Live mode ON, open: [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)  
   (Ensure the page is **not** showing test keys.)
2. Under **Standard keys**, find **Secret key** starting with `sk_live_`.
3. Click **Reveal live key** and copy immediately into your **production** secrets store (e.g. Railway production service variables).

   ```bash
   STRIPE_SECRET_KEY=sk_live_PASTE_FULL_KEY_HERE
   ```

4. Store only in **production** environment. Never commit to git.

**Optional — live publishable key:** Only if the production frontend uses Stripe.js/Elements:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Hosted Checkout via server-created session often does **not** need this.

---

## 3. Create live product: paid monthly subscription price

Test catalog **does not** carry over. Recreate in **live** mode ([Go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)).

1. Live mode ON.
2. Open: [https://dashboard.stripe.com/products](https://dashboard.stripe.com/products)
3. **Add product**.
4. **Name** (example): `Monti Paid Monthly`
5. Price:
   - **Recurring**, **Monthly**
   - **Amount** and **currency** match what you sell in production (must match legal/pricing pages).
6. Save. Copy the **live** Price ID `price_…`.
7. Production backend:

   ```bash
   STRIPE_PRICE_ID_PAID_MONTHLY=price_PASTE_LIVE_PRICE_ID_HERE
   ```

**Verify:** This `price_` must differ from your test-mode price ID.

---

## 4. Create live product: one-time top-up price

1. Live mode, **Product catalog** → **Add product**.
2. **Name** (example): `Monti Top-up 300 credits`
3. **One-time** price; amount matches published top-up price.
4. Save. Copy **live** `price_…`.
5. Production:

   ```bash
   STRIPE_PRICE_ID_TOPUP_300=price_PASTE_LIVE_TOPUP_PRICE_ID_HERE
   ```

---

## 5. Configure Customer Portal (live)

Stripe keeps **separate** portal settings for live vs sandbox ([Customer portal](https://docs.stripe.com/customer-management/integrate-customer-portal)).

1. **Live mode ON.**
2. Open: [https://dashboard.stripe.com/settings/billing/portal](https://dashboard.stripe.com/settings/billing/portal)
3. Repeat the same **policy** choices you validated in sandbox:
   - Cancellation behavior (end of period vs immediate)
   - Payment method updates
   - Invoice history
   - Plan switching / catalog (if enabled—attach **live** prices only)
4. Set **default return URL** to your **production** app URL (e.g. `https://yourdomain.com/billing` or `/`).

5. **Save.**

6. **Preview** if available; otherwise create a **real** test customer with a **small real charge** only if you intentionally want a live smoke test (many teams validate portal after first real subscriber).

Production flag:

```bash
BILLING_PORTAL_ENABLED=true
```

---

## 6. Branding and public business information (live)

Customer trust and Checkout appearance pull from these settings:

1. [https://dashboard.stripe.com/settings/branding](https://dashboard.stripe.com/settings/branding)  
   Upload production logo, set colors.

2. [https://dashboard.stripe.com/settings/public](https://dashboard.stripe.com/settings/public)  
   Set **customer-facing business name**, support URL/email, statement descriptor rules per Stripe guidance.

---

## 7. Register production webhook endpoint (live mode)

1. **Live mode ON.**
2. Open: [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
3. **Add endpoint**.
4. **URL:**

   ```text
   https://YOUR-PRODUCTION-API-HOST/api/billing/webhooks/stripe
   ```

5. **Select events** (same set as sandbox for consistency):

   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.updated` (recommended if you sync customer/payment method from portal)

6. **Add endpoint**.
7. Open the endpoint → **Signing secret** → **Reveal** → copy `whsec_…` (this is **live-only**).
8. Production env:

   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_PASTE_LIVE_SIGNING_SECRET_HERE
   STRIPE_WEBHOOKS_ENABLED=true
   ```

9. **Do not** use the staging/test `whsec_` here.

---

## 8. Stripe Tax (only if launch uses tax)

If your monetization contract enables Stripe Tax:

1. Complete [Stripe Tax setup](https://docs.stripe.com/tax/set-up).
2. Configure tax behavior on **subscriptions** and **one-time** Checkout per [Collect taxes](https://docs.stripe.com/billing/taxes/collect-taxes).
3. In Customer Portal settings, enable **Tax ID** collection if required ([portal tax IDs](https://docs.stripe.com/customer-management/integrate-customer-portal#enable-tax-id-collection)).

If you are **not** using tax at launch, explicitly confirm prices are tax-exclusive/inclusive per legal advice and do not enable Tax until ready.

---

## 9. API version and Workbench (recommended before high traffic)

Stripe recommends aligning API version and library behavior ([Go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)):

1. Open [Workbench](https://dashboard.stripe.com/workbench) (link from current Dashboard if relocated).
2. Note your account **API version**; ensure your backend Stripe SDK version is compatible ([Stripe versioning](https://docs.stripe.com/sdks)).
3. Webhook payloads follow your account API version unless you override at endpoint creation—coordinate with engineering.

---

## 10. Security and operational hygiene

1. **Restricted API keys (optional):** Consider a [restricted key](https://docs.stripe.com/keys-best-practices) with only the resources Monti needs, if Stripe’s UI allows for your use case.
2. **Key rotation:** Plan rotation if keys leaked or team members leave ([key best practices](https://docs.stripe.com/keys-best-practices)).
3. **Webhook behavior:** Production handler must tolerate **retries**, **duplicates**, and **out-of-order** events ([Go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)).
4. **Monitoring:** Use Dashboard → **Developers** → **Webhooks** to watch failed deliveries; fix endpoints before customers are blocked on grants.

---

## 11. Legal, pricing, and customer-facing alignment

Complete **before** linking production Checkout from marketing:

- Public pricing copy matches **live** amounts and currency.
- Refund/chargeback policy accessible.
- Email receipts/invoices: configure in Stripe [customer emails](https://docs.stripe.com/customer-management) / [Billing emails](https://docs.stripe.com/billing/revenue-recovery/customer-emails) per product decision.

(Owner: you / finance / legal—not this repo.)

---

## 12. Production env summary (copy-paste template)

```bash
# Production — live mode only
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PAID_MONTHLY=price_...
STRIPE_PRICE_ID_TOPUP_300=price_...

STRIPE_WEBHOOKS_ENABLED=true
BILLING_PORTAL_ENABLED=true

# Optional
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## 13. Live smoke test (controlled)

1. Use a **real** card with a **small** real transaction only if you accept real money on that account.
2. Alternatively, complete Stripe’s recommended live verification steps in their **go-live** documentation.
3. Confirm:
   - Checkout completes.
   - Webhook endpoint shows **2xx** in Dashboard.
   - Internal DB reflects subscription / grant rules (engineering verification).
4. Cancel or refund test subscriptions per your support process if you used real charges for testing.

---

## 14. Done criteria (production)

- [ ] All Stripe objects created with **live** mode ON.
- [ ] `STRIPE_SECRET_KEY` starts with `sk_live_`.
- [ ] Price IDs are **live** `price_…` values, not copied from test.
- [ ] Webhook URL is **production** HTTPS; `STRIPE_WEBHOOK_SECRET` is from the **live** endpoint.
- [ ] Customer portal configured in **live** mode with correct return URL.
- [ ] Branding and public business details reviewed.
- [ ] Go-live checklist reviewed: [https://docs.stripe.com/get-started/checklist/go-live](https://docs.stripe.com/get-started/checklist/go-live)

---

## Critical reminders

| Item | Test / staging | Production |
|------|----------------|------------|
| Secret key | `sk_test_…` | `sk_live_…` |
| Price IDs | Created in test mode | **New** IDs in live mode |
| Webhook `whsec_` | Test endpoint secret | **Different** live endpoint secret |
| Customer Portal | Test settings | **Separate** live settings |

Mixing test IDs or secrets into production will cause confusing failures or security issues. Keep environments isolated.
