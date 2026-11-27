/**
 * VetNotes Pro checkout — creates a Stripe Checkout Session for the A$49/mo plan.
 *
 * Uses the Stripe REST API directly (no `stripe` npm dependency), matching
 * `api/cpd/checkout` — same reason: no new package, no new build risk.
 *
 * ⚠️ `metadata[app_key]=vetnotes` IS A SAFETY CONTROL, NOT A LABEL.
 * This Stripe account (`acct_1SXuAsQtktamRZKg`) is shared across five products,
 * and four endpoints subscribe to `checkout.session.completed`. On 2026-08-03 an
 * unrelated A$19.99 ebook sale reached VetSorcery's `stripeWebhook` and
 * provisioned a full clinic — custom claims, sign-in link, welcome email — off an
 * unresolved tier. That webhook now guards with
 * `if (appKey && appKey !== 'vet') return`, so stamping 'vetnotes' here is what
 * stops a VetNotes Pro subscriber being handed a free VetSorcery clinic.
 * Do not remove it, and do not set it to 'vet'.
 *
 * ONE CUSTOMER, ONE SUBSCRIPTION
 * Until 2026-11-27 this route sent only `customer_email`, so every checkout made
 * a new Stripe customer and one vet could subscribe twice and be billed twice.
 * Now, before a session is created:
 *   1. the vet's ONE Stripe customer is looked up (or created and stored) from
 *      server-side state keyed by the verified uid — never from the request;
 *   2. Stripe is asked whether that customer already has a live Pro
 *      subscription. If so: 409 `already_subscribed`, use Manage subscription;
 *   3. a Pro checkout that customer already has open is resumed, not duplicated.
 * If Stripe cannot be asked, the route answers 502 and starts nothing.
 * See `$lib/server/pro_billing.ts`.
 *
 * Required env:
 *   STRIPE_SECRET_KEY       — secret key for the shared account
 *   VETNOTES_PRO_PRICE_ID   — the A$49/mo recurring price
 *
 * If unconfigured, responds 503 with { configured: false } so the pricing page can
 * fall back to its pre-sale state instead of erroring.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/server/firebase-admin';
import {
	PRO_PRODUCT,
	ensureStripeCustomer,
	findLiveProSubscription,
	findOpenProCheckout
} from '$lib/server/pro_billing';

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const secret = env.STRIPE_SECRET_KEY;
	const priceId = env.VETNOTES_PRO_PRICE_ID;
	if (!secret || !priceId) {
		return json(
			{ success: false, configured: false, error: 'VetNotes Pro checkout is not yet configured.' },
			{ status: 503 }
		);
	}

	const body = await request.json().catch(() => ({}));
	const returnPath =
		typeof body.return_path === 'string' && body.return_path.startsWith('/') ? body.return_path : '/pricing';

	const uid = locals.user.uid;
	let customerId: string;
	try {
		customerId = await ensureStripeCustomer(adminDb, { secret }, { uid, email: locals.user.email });

		const live = await findLiveProSubscription({ secret }, customerId, priceId);
		if (live) {
			return json(
				{
					success: false,
					code: 'already_subscribed',
					manage: true,
					error: 'This account already has a VetNotes Pro subscription. Use Manage subscription to change or cancel it.'
				},
				{ status: 409 }
			);
		}

		const open = await findOpenProCheckout({ secret }, customerId);
		if (open) return json({ success: true, url: open.url, sessionId: open.id, resumed: true });
	} catch (err) {
		/* Fail closed. Starting a checkout without knowing whether this vet is
		   already subscribed is how a second monthly charge happens. */
		console.error('Pro checkout: could not check the existing billing state', err);
		throw error(502, 'Unable to start checkout. Please try again.');
	}

	const form = new URLSearchParams();
	form.set('mode', 'subscription');
	form.set('customer', customerId);
	form.set('line_items[0][price]', priceId);
	form.set('line_items[0][quantity]', '1');
	form.set('client_reference_id', uid);
	form.set('metadata[user_id]', uid);
	form.set('metadata[product]', PRO_PRODUCT);
	form.set('metadata[app_key]', 'vetnotes'); // see header — safety control
	/* The subscription carries the same metadata so renewal and cancellation
	   events map back to a user; `customer.subscription.deleted` arrives with the
	   subscription object only, never the original session. */
	form.set('subscription_data[metadata][user_id]', uid);
	form.set('subscription_data[metadata][product]', PRO_PRODUCT);
	form.set('subscription_data[metadata][app_key]', 'vetnotes');
	/* No `customer_email`: Stripe rejects it alongside `customer`, and the
	   customer already carries the vet's email. */
	form.set('success_url', `${url.origin}${returnPath}?pro_paid=1`);
	form.set('cancel_url', `${url.origin}${returnPath}?pro_cancelled=1`);

	const res = await fetch(STRIPE_API, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${secret}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: form.toString()
	});

	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		console.error('Pro checkout: Stripe session creation failed', res.status, detail);
		throw error(502, 'Unable to start checkout. Please try again.');
	}

	const session = (await res.json()) as { id: string; url: string };
	return json({ success: true, url: session.url, sessionId: session.id });
};
