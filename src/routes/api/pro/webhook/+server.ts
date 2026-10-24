/**
 * Stripe webhook for VetNotes Pro subscriptions.
 *
 * Signature-verified against the raw body (no `stripe` npm dependency). The
 * decision and apply logic — dedupe, ordering, paid check, revocation on
 * cancel/unpaid/refund/dispute, expiry from the period end — lives in
 * `$lib/server/stripe_webhook.ts`, shared with `api/cpd/webhook`.
 *
 * ⚠️ Every action is gated on `metadata.product === 'vetnotes_pro'`. This
 * endpoint lives on a Stripe account shared by five products, so it will receive
 * events for sales that have nothing to do with VetNotes. Acting on an unfiltered
 * event is exactly how an ebook purchase provisioned a VetSorcery clinic on
 * 2026-08-03. Unknown product = ignore, never "grant anyway".
 *
 * Required env:
 *   STRIPE_PRO_WEBHOOK_SECRET — signing secret (whsec_...) for this endpoint
 *   STRIPE_SECRET_KEY         — to resolve refunds/disputes to a product
 *
 * Endpoint events: see the list at the top of `stripe_webhook.ts`.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/server/firebase-admin';
import { PRO_ENTITLEMENT_COLLECTION, proGrantFields, proRevokeFields } from '$lib/server/pro_entitlement';
import { firestoreStore, handleEntitlementEvent, verifyStripeSignature } from '$lib/server/stripe_webhook';

const PRO_PRODUCTS = new Set(['vetnotes_pro']);

export const POST: RequestHandler = async ({ request }) => {
	const secret = env.STRIPE_PRO_WEBHOOK_SECRET;
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
		products: PRO_PRODUCTS,
		collection: PRO_ENTITLEMENT_COLLECTION,
		store: firestoreStore(adminDb),
		grantFields: (a) =>
			proGrantFields({
				source: a.meta.source ?? 'stripe',
				expiresAt: a.expiresAt,
				stripeSessionId: a.meta.stripeSessionId ?? undefined,
				stripeCustomerId: a.meta.stripeCustomerId ?? undefined,
				stripeSubscriptionId: a.meta.stripeSubscriptionId ?? undefined,
				email: a.meta.email ?? undefined
			}),
		revokeFields: proRevokeFields,
		stripeSecret: env.STRIPE_SECRET_KEY
	});
	console.log(`[pro/webhook] ${event.type} ${event.id}: ${outcome}`);

	return json({ received: true });
};
