# Stripe Dashboard checklist — sandbox (staging)

Use this checklist for **staging** and **local integration testing**. Every step assumes you are in Stripe **test mode** (sandbox): fake money, test cards, objects that **do not** exist in live mode.

**Rule:** Staging backend env vars must use **`sk_test_…`**, **test** Price IDs (`price_…` created while test data is visible), and the **signing secret** from a **test-mode** webhook endpoint (or from Stripe CLI for local dev).

Official references:

- [API keys (sandbox vs live)](https://docs.stripe.com/keys)
- [Webhooks](https://docs.stripe.com/webhooks)
- [Customer portal](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Products and prices](https://docs.stripe.com/products-prices/manage-prices)
- [Testing](https://docs.stripe.com/testing)
- [Subscriptions with Checkout](https://docs.stripe.com/payments/subscriptions)

---

## 0. Preconditions

1. You have a Stripe account and can sign in at [https://dashboard.stripe.com/](https://dashboard.stripe.com/).
2. You know your **staging** backend public HTTPS base URL (example: `https://monti-api-staging.up.railway.app`). Replace placeholders below with yours.
3. Your Monti backend webhook path (once implemented) is assumed to be:
   - `POST /api/billing/webhooks/stripe`  
   Full URL example: `https://YOUR-STAGING-API-HOST/api/billing/webhooks/stripe`

---

## 1. Confirm you are in test mode (sandbox)

1. Open [https://dashboard.stripe.com/](https://dashboard.stripe.com/).
2. Look for **View test data** or a **Test mode** toggle (Stripe places this in the top area of the Dashboard).
3. **Turn test mode ON** / ensure **View test data** is enabled so all objects you create are sandbox-only.

If test mode is off, you are in **live mode**—do not continue this checklist for staging.

---

## 2. Copy sandbox API secret key for staging

1. With test mode ON, open: [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)  
   (If the URL redirects, confirm the page title or banner still indicates **test** / **sandbox**.)
2. Find **Secret key** — it must start with `sk_test_`.
3. Click **Reveal test key** (wording may vary) and copy the full key.
4. In your **staging** secrets manager (e.g. Railway → Variables for the staging backend service), set:

   ```bash
   STRIPE_SECRET_KEY=sk_test_PASTE_FULL_KEY_HERE
   ```

5. **Do not** commit this value to git. Do not paste it into client-side code.

**Optional — publishable key (usually skip for hosted Checkout):**  
Monti’s roadmap uses **server-created Checkout Sessions** and **browser redirect** to Stripe-hosted Checkout, which typically does **not** require `pk_test_` on the frontend. If you later add Stripe.js/Elements, you would add:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 3. Create the paid monthly subscription price (test)

Monti expects a **recurring monthly** price ID for the paid plan, mapped to `STRIPE_PRICE_ID_PAID_MONTHLY`.

1. Ensure test mode is ON.
2. Open **Product catalog**: [https://dashboard.stripe.com/test/products](https://dashboard.stripe.com/test/products)
3. Click **Add product** (or **+ Create product**).
4. Fill in:
   - **Name** (example): `Monti Paid Monthly`
   - **Description** (optional): short internal description.
5. Under **Pricing**, add a price:
   - **Pricing model:** **Standard pricing**
   - **Price:** match your launch intent (roadmap anchor example: **10.00** USD — adjust if your contract differs).
   - **Billing period:** **Monthly** (recurring).
6. Save the product.
7. On the product page, find the **Price** you created. Copy the **Price ID** (format `price_xxxxxxxxxxxxx`).
8. In **staging** backend env:

   ```bash
   STRIPE_PRICE_ID_PAID_MONTHLY=price_PASTE_TEST_PRICE_ID_HERE
   ```

---

## 4. Create the one-time top-up price (test)

Monti expects a **one-time** price for the credit top-up pack, mapped to `STRIPE_PRICE_ID_TOPUP_300`.

1. Still in test mode, open: [https://dashboard.stripe.com/test/products](https://dashboard.stripe.com/test/products)
2. Click **Add product**.
3. **Name** (example): `Monti Top-up 300 credits`
4. Add a price:
   - **One time** (not recurring).
   - **Amount:** match your launch intent (roadmap example: **4.00** USD).
5. Save.
6. Copy the **Price ID** (`price_…`).
7. In **staging** backend env:

   ```bash
   STRIPE_PRICE_ID_TOPUP_300=price_PASTE_TEST_TOPUP_PRICE_ID_HERE
   ```

---

## 5. Configure Customer Portal (sandbox)

Portal settings are **separate per mode**. Configure while **test data** is visible.

1. Open: [https://dashboard.stripe.com/test/settings/billing/portal](https://dashboard.stripe.com/test/settings/billing/portal)  
   If Stripe routes you through a generic settings URL, confirm the page indicates **test** / sandbox configuration.
2. Enable features you want for staging (align with product policy), for example:
   - **Cancel subscriptions** — choose **at end of billing period** vs **immediately** per your monetization contract.
   - **Update payment method** — typically ON.
   - **View invoice history** — typically ON for subscriptions.
3. If the portal allows **plan changes**, Stripe requires a **product catalog** for upgradable/downgradable prices ([portal product catalog](https://docs.stripe.com/customer-management/integrate-customer-portal#set-a-product-catalog)). If Monti only sells one paid tier, you may leave plan switching off or point at a minimal catalog—decide with your contract.
4. Set **Default return URL** (optional if your API always passes `return_url`): e.g. `https://YOUR-STAGING-WEB-HOST/` or `/billing` when that route exists.
5. Click **Save**.

**Test the portal UI:**

1. Open **Customers** in test mode: [https://dashboard.stripe.com/test/customers](https://dashboard.stripe.com/test/customers)
2. Create a **test customer** if none exist: **Add customer**, enter a test email, save.
3. Open the customer → **Actions** → **Open customer portal** (wording per current Dashboard).
4. Confirm the portal loads and matches your toggles.

Staging backend flag (when implemented):

```bash
BILLING_PORTAL_ENABLED=true
```

---

## 6. Branding (optional for staging, quick sanity check)

1. [https://dashboard.stripe.com/settings/branding](https://dashboard.stripe.com/settings/branding)  
   Branding may be shared or scoped—upload a logo if you want Checkout/portal to look closer to prod.

2. [https://dashboard.stripe.com/settings/public](https://dashboard.stripe.com/settings/public)  
   Review **public business name** and support details shown on hosted surfaces.

---

## 7. Register a webhook endpoint (test mode → staging URL)

1. With **test mode ON**, open: [https://dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click **Add endpoint** (or **Add webhook endpoint**).
3. **Endpoint URL:** paste exactly (replace host):

   ```text
   https://YOUR-STAGING-API-HOST/api/billing/webhooks/stripe
   ```

4. **Description** (optional): `Monti staging billing`
5. **Events to send:** choose **Select events** (not “Send all events” unless you intend to maintain that).
6. Subscribe at minimum to these event types (Monti monetization roadmap / Proposal 5):

   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   **Recommended additions** if your implementation syncs portal-driven changes:

   - `customer.updated`

7. Click **Add endpoint**.
8. Open the endpoint you created. Find **Signing secret** → **Reveal** → copy `whsec_…`.
9. In **staging** backend env:

   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_PASTE_SIGNING_SECRET_HERE
   ```

10. When your app is ready to process webhooks:

    ```bash
    STRIPE_WEBHOOKS_ENABLED=true
    ```

---

## 8. Local development (optional): Stripe CLI instead of a public staging URL

If your laptop is not on the public internet, use the CLI to forward events ([Webhooks – CLI](https://docs.stripe.com/webhooks#test-webhook)):

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Run:

   ```bash
   stripe login
   ```

3. Forward to your local backend (adjust port/path):

   ```bash
   stripe listen --forward-to localhost:3001/api/billing/webhooks/stripe
   ```

4. The CLI prints a **webhook signing secret** (`whsec_…`). Use **that** secret in your **local** `.env` as `STRIPE_WEBHOOK_SECRET` while using CLI forwarding—not the Dashboard endpoint secret.

5. Trigger test events if needed:

   ```bash
   stripe trigger payment_intent.succeeded
   ```

   For subscription flows, use triggers or complete Checkout in test mode per [Billing testing](https://docs.stripe.com/billing/testing).

---

## 9. Smoke-test payments in sandbox

1. Use Stripe’s test card numbers: [https://docs.stripe.com/testing](https://docs.stripe.com/testing)  
   Common success card: `4242 4242 4242 4242`, any future expiry, any CVC, any postal code if asked.
2. Complete a **test Checkout** session once your backend exposes session creation (future implementation).
3. In Dashboard → **Developers** → **Logs**, confirm API calls succeed with `sk_test_`.
4. In **Webhooks** → your endpoint → **Events**, confirm deliveries show **2xx** responses after your handler exists.

---

## 10. Staging env summary (copy-paste template)

Replace placeholders. Use only **test** keys and **test** price IDs.

```bash
# Staging / sandbox — must all be test mode
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PAID_MONTHLY=price_...
STRIPE_PRICE_ID_TOPUP_300=price_...

STRIPE_WEBHOOKS_ENABLED=true
BILLING_PORTAL_ENABLED=true

# Optional until frontend needs Stripe.js
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 11. Done criteria (sandbox)

- [ ] Dashboard is in **test mode** for all steps above.
- [ ] `STRIPE_SECRET_KEY` starts with `sk_test_`.
- [ ] Both Price IDs start with `price_` and were created in test mode.
- [ ] Webhook endpoint URL points to **staging** HTTPS and uses the **test** endpoint signing secret in `STRIPE_WEBHOOK_SECRET`.
- [ ] Customer portal saved under **test** configuration; test customer can open portal.
- [ ] Test card checkout succeeds once Checkout is implemented; webhook deliveries succeed.

---

## Important reminder

**Nothing you create in this checklist carries over to production.** Live mode needs its own products, prices, webhook endpoint, signing secret, and portal configuration. Follow `stripe-dashboard-production-checklist.md` before launch.
