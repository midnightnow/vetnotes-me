/**
 * Stripe webhook for CPD certification purchases.
 *
 * Signature-verified against the raw body (no `stripe` npm dependency). Grants a
 * CPD entitlement on a paid checkout; revokes on subscription cancellation, a
 * full refund or a dispute. Dedupe, ordering and the paid check live in
 * `$lib/server/stripe_webhook.ts`, shared with `api/pro/webhook`. Before
 * 2026-10-24 a refunded one-off pass kept a lifetime entitlement.
 *
 * Required env:
 *   STRIPE_CPD_WEBHOOK_SECRET — the signing secret (whsec_...) for this endpoint
 *   STRIPE_SECRET_KEY         — to resolve refunds/disputes to a product
 *
 * Endpoint events: see the list at the top of `stripe_webhook.ts`.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/server/firebase-admin';
import { cpdGrantFields, cpdRevokeFields } from '$lib/server/cpd_entitlement';
import { firestoreStore, handleEntitlementEvent, verifyStripeSignature } from '$lib/server/stripe_webhook';

const CPD_PRODUCTS = new Set(['cpd_pass', 'cpd_certification']); // '..._certification' = back-compat

export const POST: RequestHandler = async ({ request }) => {
  const secret = env.STRIPE_CPD_WEBHOOK_SECRET;
  if (!secret) {
    return json({ received: false, configured: false }, { status: 503 });
  }

  // Raw body is required for signature verification — do not parse first.
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get('stripe-signature'), secret)) {
    throw error(400, 'Invalid Stripe signature');
  }

  const event = JSON.parse(payload);
  // A thrown error returns 500, so Stripe retries; the ledger makes the retry safe.
  const outcome = await handleEntitlementEvent(event, {
    products: CPD_PRODUCTS,
    collection: 'cpd_entitlements',
    store: firestoreStore(adminDb),
    grantFields: (a) =>
      cpdGrantFields({
        source: a.meta.source ?? 'stripe',
        plan: a.meta.plan || 'all_access',
        // One-off pass = lifetime (null). Subscription passes get the period end.
        expiresAt: a.expiresAt,
        stripeSessionId: a.meta.stripeSessionId ?? undefined,
        stripeCustomerId: a.meta.stripeCustomerId ?? undefined,
        email: a.meta.email ?? undefined
      }),
    revokeFields: cpdRevokeFields,
    stripeSecret: env.STRIPE_SECRET_KEY
  });
  console.log(`[cpd/webhook] ${event.type} ${event.id}: ${outcome}`);

  return json({ received: true });
};
