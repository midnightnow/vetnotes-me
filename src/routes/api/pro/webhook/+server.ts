/**
 * Stripe webhook for VetNotes Pro subscriptions.
 *
 * Signature-verified against the raw body (no `stripe` npm dependency), matching
 * `api/cpd/webhook`. Grants on `checkout.session.completed`, revokes on
 * `customer.subscription.deleted`.
 *
 * ⚠️ Every handler here filters on `metadata.product === 'vetnotes_pro'` BEFORE
 * acting. This endpoint lives on a Stripe account shared by five products, so it
 * will receive events for sales that have nothing to do with VetNotes. Acting on
 * an unfiltered event is exactly how an ebook purchase provisioned a VetSorcery
 * clinic on 2026-08-03. Unknown product = ignore, never "grant anyway".
 *
 * Required env:
 *   STRIPE_PRO_WEBHOOK_SECRET — signing secret (whsec_...) for this endpoint
 *
 * Point a Stripe webhook at POST /api/pro/webhook for events:
 *   checkout.session.completed, customer.subscription.deleted
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';
import { grantProEntitlement, revokeProEntitlement } from '$lib/server/pro_entitlement';

const TOLERANCE_SECONDS = 300;

function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
	if (!header) return false;
	const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
	const timestamp = parts['t'];
	const signature = parts['v1'];
	if (!timestamp || !signature) return false;

	// Reject stale timestamps to blunt replay attacks.
	const age = Math.floor(Date.now() / 1000) - Number(timestamp);
	if (!Number.isFinite(age) || Math.abs(age) > TOLERANCE_SECONDS) return false;

	const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
	const a = Buffer.from(expected);
	const b = Buffer.from(signature);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}

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
	const PRO_PRODUCT = 'vetnotes_pro';

	if (event.type === 'checkout.session.completed') {
		const session = event.data?.object || {};
		const userId = session.client_reference_id || session.metadata?.user_id;
		if (userId && session.metadata?.product === PRO_PRODUCT) {
			await grantProEntitlement(userId, {
				source: 'stripe_checkout',
				stripeSessionId: session.id,
				stripeCustomerId: session.customer,
				stripeSubscriptionId: session.subscription,
				email: session.customer_details?.email || session.customer_email
			});
		}
	} else if (event.type === 'customer.subscription.deleted') {
		const sub = event.data?.object || {};
		const userId = sub.metadata?.user_id;
		if (userId && sub.metadata?.product === PRO_PRODUCT) {
			await revokeProEntitlement(userId, 'subscription_deleted');
		}
	}

	// Always 200 quickly so Stripe doesn't retry a handled event.
	return json({ received: true });
};
