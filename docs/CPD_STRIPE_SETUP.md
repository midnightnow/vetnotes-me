# CPD Pass — Stripe activation (Phase 2)

The CPD money path is fully wired as an **all-access CPD Pass**: one purchase
unlocks the verifiable completion certificate on every case. Everything works
except the Stripe credentials — until they're set, checkout returns a graceful
503 ("launching soon") and the free learn/score/paywall-CTA flow stays live.

Three steps.

## 1. Create the price in Stripe (existing account)

Create a **Product** "VetNotes CPD Pass" with one **Price**:
- **One-off pass (recommended default):** one-time price (e.g. A$XX). Grants a
  lifetime all-access pass.
- **Recurring pass (optional):** a recurring price (e.g. A$XX/year). Also set
  `CPD_CHECKOUT_MODE=subscription` in step 2 — the webhook then revokes access on
  `customer.subscription.deleted`.

Copy the **Price ID** (`price_…`).

## 2. Set env on the Cloud Run service

⚠️ Use `--update-env-vars` (NOT `--set-env-vars`, which wipes the existing set and
would drop `GOOGLE_CLOUD_PROJECT=vetsorcery`).

```bash
gcloud run services update vetnotes-cpd-ssr \
  --project vetnotes-mvp --region australia-southeast1 \
  --update-env-vars \
STRIPE_SECRET_KEY=sk_live_xxx,CPD_PRICE_ID=price_xxx,STRIPE_CPD_WEBHOOK_SECRET=whsec_xxx
# add ,CPD_CHECKOUT_MODE=subscription only for the recurring model
```

## 3. Create the Stripe webhook

Dashboard → Developers → Webhooks → Add endpoint:
- **URL:** `https://vetnotes.me/api/cpd/webhook`
- **Events:** `checkout.session.completed` (one-off) — add
  `customer.subscription.deleted` for the recurring model.
- Copy the **Signing secret** (`whsec_…`) into `STRIPE_CPD_WEBHOOK_SECRET` (step 2).

## Verify

1. Sign in at `vetnotes.me/cpd`, complete a case, pass it.
2. Click **Get the CPD Pass** → Stripe Checkout (use a test card in test mode).
3. On return, the certificate unlocks (entitlement written to
   `cpd_entitlements/{uid}`), and the printable record + `/verify` are available.

## How it fits together (already built)

- `POST /api/cpd/checkout` → Stripe Checkout Session (metadata `product=cpd_pass`).
- `POST /api/cpd/webhook` → signature-verified; `checkout.session.completed` →
  `grantCpdEntitlement` (all-access); `customer.subscription.deleted` → revoke.
- `hasCpdEntitlement` gates certificate issuance + the printable record; respects
  `expires_at` for time-boxed passes. Paid subscription tiers bundle it for free.
